// Se dispara desde un trigger de Postgres (after insert/update en agenda_citas, vía pg_net) y
// manda por correo (Resend) la confirmación, el cambio de horario o la cancelación de una visita
// reservada desde el sitio. Valida con su propio x-cron-secret — el mismo que ya usan las demás
// funciones disparadas por la base —, así que se despliega con la verificación de JWT desactivada.
// Lee con la service role key inyectada por Supabase. Variables: RESEND_API_KEY (obligatoria),
// RESEND_FROM y SITE_URL (opcionales; ver los valores por omisión en _shared).
// La lógica vive en handler.js (con pruebas); este archivo solo conecta con Deno.

import { handleVisitEmail } from "./handler.js";
import { sendResendEmail } from "../_shared/resend.js";

const SELECT =
  "id, fecha, hora, duracion_min, status, booking_token, contact_name, contact_email, reschedule_count, cancelled_by, property:properties(id, title, code, address), advisor:advisors(name)";

async function handler(req: Request): Promise<Response> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado" }), { status: 500 });
  }

  const payload = await req.json().catch(() => ({}));
  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const result = await handleVisitEmail(payload, {
      loadCita: async (id: string) => {
        const { data, error } = await supabase.from("agenda_citas").select(SELECT).eq("id", id).maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      },
      sendEmail: (message: Record<string, unknown>) => sendResendEmail({ apiKey, from: Deno.env.get("RESEND_FROM") || undefined, ...message }),
      siteUrl: Deno.env.get("SITE_URL") || undefined,
    });
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
}

// Solo dentro de Deno (en las pruebas se importa handler.js y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
