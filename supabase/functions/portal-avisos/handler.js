// Avisos al cliente del portal (ver _shared/portalAvisos.js). Lo llaman dos cosas, con el mismo
// x-cron-secret que las demás funciones disparadas por la base:
//  · el trigger de client_tramites, al cambiar la etapa: { kind: "etapa", client_id }
//  · pg_cron, una vez al día: { kind: "recordatorios" }
// Cada aviso se «reclama» en la base ANTES de mandarlo (portal_claim_stage_notice / portal_claim_reminder),
// así que dos corridas o un reintento nunca lo duplican; si el envío falla, se libera el reclamo.
// Lógica con dependencias inyectadas para probarla sin Deno.

import { MAX_REMINDERS, DEFAULT_SITE_URL, buildReminderEmail, buildStageEmail, canNotify, pendingDocs } from "../_shared/portalAvisos.js";

const ok = (body) => ({ status: 200, body });

/**
 * loadNotice(clientId) → { tramite, client, token } | null   (token: el del enlace vigente, o null)
 * claimStageNotice(clientId, stage) → true si esta corrida logró reclamar el aviso de esa etapa.
 * listReminderCandidates() → [{ client_id }]  (notify_client y con recordatorios por mandar; el filtro fino va aquí)
 * loadPortalStatus(token) → lo que devuelve portal_token_status()
 * claimReminder(clientId) → { claimed, prev_at, prev_count }
 * releaseReminder(clientId, { prev_at, prev_count })
 * sendEmail({ to, subject, html, text }) → manda el correo (lanza si falla)
 */
export async function handlePortalAvisos(payload, deps) {
  const siteUrl = deps.siteUrl || DEFAULT_SITE_URL;

  if (payload?.kind === "etapa") {
    const clientId = String(payload.client_id || "");
    if (!clientId) return { status: 400, body: { error: "client_id requerido" } };
    const notice = await deps.loadNotice(clientId);
    if (!notice?.tramite?.notify_client) return ok({ skipped: "avisos desactivados" });
    if (!canNotify(notice.client, notice.token)) return ok({ skipped: "sin correo o sin enlace vigente" });
    if (!(await deps.claimStageNotice(clientId, notice.tramite.stage))) return ok({ skipped: "ya avisada" });
    try {
      const email = buildStageEmail({ client: notice.client, tramite: notice.tramite, token: notice.token, siteUrl });
      await deps.sendEmail({ to: String(notice.client.email).trim(), ...email });
      return ok({ sent: 1 });
    } catch (err) {
      return { status: 500, body: { error: err instanceof Error ? err.message : String(err) } };
    }
  }

  if (payload?.kind === "recordatorios") {
    const candidates = await deps.listReminderCandidates();
    const results = {};
    let sent = 0;
    for (const { client_id: clientId } of candidates) {
      const notice = await deps.loadNotice(clientId);
      if (!notice?.tramite?.notify_client) continue;
      if (!canNotify(notice.client, notice.token)) {
        results[clientId] = "sin correo o sin enlace vigente";
        continue;
      }
      const status = await deps.loadPortalStatus(notice.token);
      if (status?.status !== "activo") {
        results[clientId] = "enlace no vigente";
        continue;
      }
      const pending = pendingDocs(status);
      if (pending.length === 0) {
        results[clientId] = "sin pendientes";
        continue;
      }
      const claim = await deps.claimReminder(clientId);
      if (!claim?.claimed) {
        results[clientId] = "reclamado o sin recordatorios por mandar";
        continue;
      }
      try {
        const email = buildReminderEmail({ client: notice.client, pending, token: notice.token, siteUrl });
        await deps.sendEmail({ to: String(notice.client.email).trim(), ...email });
        results[clientId] = "enviado";
        sent += 1;
      } catch (err) {
        await deps.releaseReminder(clientId, claim).catch(() => {});
        results[clientId] = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    return ok({ sent, results, max_reminders: MAX_REMINDERS });
  }

  return { status: 400, body: { error: "kind desconocido" } };
}
