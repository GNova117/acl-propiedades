// Se ejecuta cada 15 minutos (pg_cron, ver el bloque de la fase 5 de "Agendar visita" en
// schema.sql) y manda por correo (Resend) el recordatorio de ~24 h y el de ~2 h antes de las
// visitas reservadas desde el sitio. Valida con su propio x-cron-secret (se despliega con la
// verificación de JWT desactivada) y corre con la service role key porque lee las citas de todos
// los asesores. La lógica vive en handler.js (con pruebas); este archivo solo conecta con Deno.

import { runVisitReminders } from "./handler.js";
import { sendResendEmail } from "../_shared/resend.js";

const SELECT =
  "id, fecha, hora, duracion_min, booking_token, contact_name, contact_email, reschedule_count, client_confirmed_at, updated_at, email_reminder_24h_at, email_reminder_2h_at, property:properties(id, title, code, address), advisor:advisors(name)";

async function handler(req: Request): Promise<Response> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado" }), { status: 500 });
  }

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const results = await runVisitReminders({
      loadCandidates: async ({ from, to }: { from: string; to: string }) => {
        const { data, error } = await supabase
          .from("agenda_citas")
          .select(SELECT)
          .eq("source", "sitio")
          .eq("status", "confirmada")
          .not("contact_email", "is", null)
          .not("hora", "is", null)
          .gte("fecha", from)
          .lte("fecha", to);
        if (error) throw new Error(error.message);
        return data || [];
      },
      claim: async (id: string, flag: string) => {
        const { data } = await supabase.from("agenda_citas").update({ [flag]: new Date().toISOString() }).eq("id", id).is(flag, null).select("id").maybeSingle();
        return Boolean(data);
      },
      release: async (id: string, flag: string) => {
        await supabase.from("agenda_citas").update({ [flag]: null }).eq("id", id);
      },
      sendEmail: (message: Record<string, unknown>) => sendResendEmail({ apiKey, from: Deno.env.get("RESEND_FROM") || undefined, ...message }),
      siteUrl: Deno.env.get("SITE_URL") || undefined,
    });
    return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
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
