// Recordatorios por correo de las visitas reservadas desde el sitio: ~24 h antes (con el botón
// para confirmar asistencia) y ~2 h antes (con el mapa). Los dispara pg_cron cada 15 minutos
// (ver el bloque de la fase 5 en supabase/schema.sql). Cada recordatorio se "reclama" en la
// cita (email_reminder_24h_at / email_reminder_2h_at) ANTES de mandarlo, así que dos corridas
// nunca lo duplican; si el envío falla, se libera el reclamo para reintentarlo en la siguiente
// corrida (la ventana de cada recordatorio dura varias corridas). Lógica con dependencias
// inyectadas para probarla sin Deno.

import { DEFAULT_SITE_URL, addDays, buildVisitEmail, mexicoNow, minutesUntilVisit, recentlyChanged, reminderKindFor } from "../_shared/visitEmail.js";

const FLAG = { recordatorio24h: "email_reminder_24h_at", recordatorio2h: "email_reminder_2h_at" };

/**
 * loadCandidates({ from, to }) → citas del sitio, confirmadas y con correo, con fecha entre `from` y `to`.
 * claim(citaId, flag) → true si esta corrida logró marcar el recordatorio (false: otra ya lo reclamó).
 * release(citaId, flag) → quita la marca (para reintentar tras un fallo de envío).
 * sendEmail({ to, subject, html, text }) → manda el correo (lanza si falla).
 */
export async function runVisitReminders({ now = new Date(), loadCandidates, claim, release, sendEmail, siteUrl = DEFAULT_SITE_URL }) {
  const today = mexicoNow(now).date;
  const citas = await loadCandidates({ from: today, to: addDays(today, 1) });
  const results = {};

  for (const cita of citas) {
    const kind = reminderKindFor(minutesUntilVisit(cita.fecha, cita.hora, now));
    if (!kind) continue; // todavía no toca (o ya pasó la ventana)
    const flag = FLAG[kind];
    const key = `${cita.id}:${kind}`;

    if (cita[flag]) continue; // ya se mandó
    if (recentlyChanged(cita.updated_at, now)) {
      results[key] = "agendada o movida hace poco, se omite";
      continue;
    }
    if (!(await claim(cita.id, flag))) {
      results[key] = "ya reclamada por otra corrida, se omite";
      continue;
    }

    try {
      const email = buildVisitEmail(kind, cita, { siteUrl, now });
      await sendEmail({ to: String(cita.contact_email).trim(), subject: email.subject, html: email.html, text: email.text });
      results[key] = "enviado";
    } catch (err) {
      await release(cita.id, flag).catch(() => {});
      results[key] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return results;
}
