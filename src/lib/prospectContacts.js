// Registro de contactos con un prospecto (llamada, WhatsApp...): helpers puros
// que usan la tarjeta de Prospectos y su formulario de "Registrar contacto".
// Cada contacto queda en prospecto_contactos (historial); además se actualiza
// el propio prospecto (último contacto, etapa y próximo seguimiento).

import { followUpState, todayISO } from "./prospects";

export const CONTACT_CHANNELS = ["llamada", "whatsapp", "correo", "presencial"];

// Atajos de "próximo seguimiento", en días a partir de hoy.
export const FOLLOWUP_PRESET_DAYS = [1, 3, 7];

export function addDaysISO(days, from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days).toLocaleDateString("en-CA");
}

// Campos del prospecto que cambian al registrar un contacto. Un prospecto
// "nuevo" pasa a "contactado" (eso es lo que mide el tiempo de primera
// respuesta del embudo). Con fecha de seguimiento nueva se reemplaza la
// anterior; sin ella, un seguimiento vencido o de hoy se da por atendido y uno
// futuro se respeta.
export function contactUpdateFields(prospect, { nextFollowupAt = "", now = new Date() } = {}) {
  const fields = { last_contact_at: now.toISOString() };
  if (prospect.stage === "nuevo") fields.stage = "contactado";
  if (nextFollowupAt) fields.next_followup_at = nextFollowupAt;
  else if (followUpState(prospect)) fields.next_followup_at = null;
  return fields;
}

// Devuelve { campo: "clave i18n" } con los errores; vacío si todo está bien.
export function validateContact({ channel, nextFollowupAt }) {
  const errors = {};
  if (!CONTACT_CHANNELS.includes(channel)) errors.channel = "prospects.contact.errors.channel";
  if (nextFollowupAt && nextFollowupAt < todayISO()) errors.nextFollowupAt = "prospects.contact.errors.pastDate";
  return errors;
}
