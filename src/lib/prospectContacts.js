// Registro de contactos con un prospecto (llamada, WhatsApp...): helpers puros
// que usa el formulario de "Registrar contacto" de la tarjeta de Prospectos.
// Cada contacto queda en prospecto_contactos (historial); además se actualiza
// el propio prospecto con contactFields() (prospects.js: último contacto, etapa
// y próximo seguimiento).

import { addDaysISO, contactFields, todayISO } from "./prospects";

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

// Resultados de contacto de un toque (lo más común tras llamar o escribir): registran el contacto y
// programan el siguiente seguimiento sin pasar por el resto del formulario. `days`: cuándo es el
// seguimiento; `stage`: etapa a la que se avanza (nunca se retrocede, ver advancedStage); `channel`:
// el canal si todavía no se había elegido.
export const CONTACT_OUTCOMES = [
  { key: "noAnswer", channel: "llamada", days: 1 },
  { key: "callLater", channel: "llamada", days: 1 },
  { key: "interested", channel: "llamada", days: 3, stage: "interesado" },
];

// Lo que se guarda al tocar un resultado: el canal ya elegido (o el del resultado), la nota (su texto) y
// el seguimiento. `now` para poder probarlo.
export function outcomeValues(outcome, { channel = "", note, now = new Date() }) {
  return {
    channel: CONTACT_CHANNELS.includes(channel) ? channel : outcome.channel,
    note,
    nextFollowup: addDaysISO(outcome.days, now),
    stage: outcome.stage,
  };
}

const OPEN_ORDER = ["nuevo", "contactado", "interesado", "negociacion"];

// La etapa a la que se avanza: `target` solo si está más adelante que `current` en el embudo abierto
// (un «Interesado» no regresa a nadie de «En negociación»); undefined si no hay que cambiarla.
export function advancedStage(current, target) {
  const from = OPEN_ORDER.indexOf(current);
  const to = OPEN_ORDER.indexOf(target);
  return from !== -1 && to > from ? target : undefined;
}

// Todo lo que cambia en el prospecto al registrar un contacto: último contacto, siguiente seguimiento,
// «nuevo» → «contactado» (contactFields) y, si el resultado lo pide (`stage`, p. ej. «Interesado»), el
// avance de etapa. Lo usan todas las pantallas que registran contactos.
export function contactUpdate(prospect, { nextFollowup, stage, now } = {}) {
  const fields = contactFields(prospect, nextFollowup, now);
  const advanced = advancedStage(fields.stage ?? prospect.stage, stage);
  if (advanced) fields.stage = advanced;
  return fields;
}
