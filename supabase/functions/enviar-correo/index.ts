// Envío puntual de UN correo por una acción del staff — no por pg_cron. Lo usan el botón "Enviar por
// correo" de Visitas (informe al vendedor) y de Gastos (desglose en PDF).
//
// Se deja con "Enforce JWT Verification" activado, pero eso SOLO no alcanza: la llave anon del sitio
// público también es un JWT válido. Por eso handler.js comprueba que el token sea de un usuario real
// con un rol que tenga el apartado 'visitas' o 'gastos' (has_admin_section, la misma función que usan
// las políticas RLS), valida el destinatario y los adjuntos y limita los envíos por hora. Los envíos se
// registran en email_send_log con la service role (ver schema.sql); si esa tabla aún no existe el tope
// por hora no se aplica, pero la verificación de usuario sí.
// Variables: RESEND_API_KEY (obligatoria), RESEND_FROM (opcional). SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase.
// La lógica vive en handler.js (con pruebas); este archivo solo conecta con Deno.

import { handleStaffEmail } from "./handler.js";
import { sendResendEmail } from "../_shared/resend.js";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado" }), { status: 500 });
  }

  const payload = await req.json().catch(() => null);
  const authorization = req.headers.get("authorization");
  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const url = Deno.env.get("SUPABASE_URL")!;
  // Cliente con la sesión de quien llama: así has_admin_section() evalúa auth.email() de esa persona.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const result = await handleStaffEmail(
      { authorization, payload },
      {
        getUser: async (token: string) => {
          const { data, error } = await asUser.auth.getUser(token);
          return error ? null : data?.user ?? null;
        },
        hasSection: async (section: string) => {
          const { data, error } = await asUser.rpc("has_admin_section", { section });
          return !error && data === true;
        },
        countRecent: async (email: string) => {
          const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { count, error } = await service.from("email_send_log").select("id", { count: "exact", head: true }).eq("user_email", email).gte("created_at", since);
          return error ? 0 : count ?? 0;
        },
        logSend: async (email: string, to: string) => {
          await service.from("email_send_log").insert({ user_email: email, to_email: to });
        },
        sendEmail: (message: { to: string; subject: string; html: string; attachments: { filename: string; content: string }[] }) =>
          sendResendEmail({ apiKey, from: Deno.env.get("RESEND_FROM") || undefined, ...message }),
      },
    );
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("enviar-correo", err);
    return new Response(JSON.stringify({ error: "No se pudo enviar el correo" }), { status: 502 });
  }
}

// Solo dentro de Deno (en las pruebas se importa handler.js y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
