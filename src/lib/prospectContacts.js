// Registro de contactos con un prospecto (llamada, WhatsApp...): helpers puros
// que usa el formulario de "Registrar contacto" de la tarjeta de Prospectos.
// Cada contacto queda en prospecto_contactos (historial); además se actualiza
// el propio prospecto con contactFields() (prospects.js: último contacto, etapa
// y próximo seguimiento).

import { todayISO } from "./prospects";

export const CONTACT_CHANNELS = ["llamada", "whatsapp", "correo", "presencial"];

// Valores especiales de la elección de seguimiento (cualquier otro valor es una
// fecha YYYY-MM-DD): dejar la fecha futura que ya tenía, o no dar ninguna.
export const FOLLOWUP_KEEP = "keep";
export const FOLLOWUP_NONE = "none";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// La elección del formulario como el argumento `nextFollowup` de contactFields:
// una fecha, null (sin fecha) o undefined (no tocar una fecha futura).
export function followupArg(choice) {
  if (choice === FOLLOWUP_NONE) return null;
  if (!choice || choice === FOLLOWUP_KEEP) return undefined;
  return choice;
}

// Devuelve { campo: "clave i18n" } con los errores; vacío si todo está bien.
// `askFollowup`: en una etapa abierta el seguimiento se pide explícito (fecha,
// "dejar la que tiene" o "sin fecha"), para que el prospecto no se quede sin
// fecha por descuido; en cerrado y perdido no aplica.
export function validateContact({ channel, followup = "", askFollowup = false }) {
  const errors = {};
  if (!CONTACT_CHANNELS.includes(channel)) errors.channel = "prospects.contact.errors.channel";
  if (askFollowup && !followup) errors.followup = "prospects.contact.errors.followup";
  else if (ISO_DATE.test(followup) && followup < todayISO()) errors.followup = "prospects.contact.errors.pastDate";
  return errors;
}
