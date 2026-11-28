// Avisos por correo al cliente del portal: «tu trámite avanzó» (trigger de client_tramites) y
// recordatorios de documentos pendientes (pg_cron, una vez al día). Valida con su propio
// x-cron-secret —el mismo que usan las demás funciones disparadas por la base—, así que se despliega
// con la verificación de JWT desactivada. Lee con la service role key inyectada por Supabase.
// Variables: RESEND_API_KEY (obligatoria), RESEND_FROM y SITE_URL (opcionales).
// La lógica vive en handler.js (con pruebas); este archivo solo conecta con Deno y con la base.

import { handlePortalAvisos } from "./handler.js";
import { sendResendEmail } from "../_shared/resend.js";
import { isCronAuthorized } from "../_shared/cronAuth.js";

async function handler(req: Request): Promise<Response> {
  if (!(await isCronAuthorized(req, "portal-avisos"))) {
    return new Response("unauthorized", { status: 401 });
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado" }), { status: 500 });
  }

  const payload = await req.json().catch(() => ({}));
  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  try {
    const result = await handlePortalAvisos(payload, {
      siteUrl: Deno.env.get("SITE_URL") || undefined,
      loadNotice: async (clientId: string) => {
        const [tramite, client, token] = await Promise.all([
          supabase.from("client_tramites").select("client_id, stage, note, requested_docs, notify_client").eq("client_id", clientId).maybeSingle(),
          supabase.from("clients").select("id, name, type, email, active").eq("id", clientId).maybeSingle(),
          supabase.from("client_portal_tokens").select("token").eq("client_id", clientId).eq("active", true).gt("expires_at", new Date().toISOString()).maybeSingle(),
        ]);
        fail(tramite.error);
        fail(client.error);
        fail(token.error);
        return tramite.data && client.data ? { tramite: tramite.data, client: client.data, token: token.data?.token ?? null } : null;
      },
      claimStageNotice: async (clientId: string, stage: string) => {
        const { data, error } = await supabase.rpc("portal_claim_stage_notice", { p_client_id: clientId, p_stage: stage });
        fail(error);
        return data === true;
      },
      listReminderCandidates: async () => {
        const { data, error } = await supabase.from("client_tramites").select("client_id").eq("notify_client", true);
        fail(error);
        return data || [];
      },
      loadPortalStatus: async (token: string) => {
        const { data, error } = await supabase.rpc("portal_token_status", { p_token: token });
        fail(error);
        return data;
      },
      claimReminder: async (clientId: string) => {
        const { data, error } = await supabase.rpc("portal_claim_reminder", { p_client_id: clientId });
        fail(error);
        return data;
      },
      releaseReminder: async (clientId: string, claim: { prev_at: string | null; prev_count: number }) => {
        const { error } = await supabase.rpc("portal_release_reminder", { p_client_id: clientId, p_prev_at: claim.prev_at, p_prev_count: claim.prev_count });
        fail(error);
      },
      sendEmail: (message: Record<string, unknown>) => sendResendEmail({ apiKey, from: Deno.env.get("RESEND_FROM") || undefined, ...message }),
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
