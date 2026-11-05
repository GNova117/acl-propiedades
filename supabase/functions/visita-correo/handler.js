// Correo de una visita reservada desde el sitio: confirmación, cambio de horario o
// cancelación. Lo dispara un trigger de agenda_citas (ver "Agendar visita con horarios
// reales, fase 5" en supabase/schema.sql) con { cita_id, kind }. La lógica está aquí, con
// las dependencias inyectadas (cargar la cita y mandar el correo), para probarla sin Deno.

import { buildVisitEmail, DEFAULT_SITE_URL } from "../_shared/visitEmail.js";

export const KINDS = ["confirmacion", "reprogramada", "cancelacion"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve { status, body }. Lanza solo si falla la carga o el envío (el servidor responde 500).
export async function handleVisitEmail({ cita_id: citaId, kind } = {}, { loadCita, sendEmail, siteUrl = DEFAULT_SITE_URL, now = new Date() }) {
  if (!citaId || !KINDS.includes(kind)) return { status: 400, body: { error: "Faltan cita_id o kind válido" } };

  const cita = await loadCita(citaId);
  if (!cita) return { status: 404, body: { error: "cita no encontrada" } };

  const to = String(cita.contact_email ?? "").trim();
  if (!EMAIL_RE.test(to)) return { status: 200, body: { skipped: "sin correo válido" } };

  // El trigger manda el aviso al cambiar la fila; si para cuando corre esto la cita ya cambió otra
  // vez (p. ej. se canceló justo después de reservar), se manda lo que corresponde a su estado actual.
  const expected = kind === "cancelacion" ? "cancelada" : "confirmada";
  if ((cita.status || "confirmada") !== expected) return { status: 200, body: { skipped: `la cita ya está ${cita.status}` } };

  const email = buildVisitEmail(kind, cita, { siteUrl, now });
  const sent = await sendEmail({ to, subject: email.subject, html: email.html, text: email.text, attachments: email.attachments });
  return { status: 200, body: { ok: true, kind, id: sent?.id ?? null } };
}
