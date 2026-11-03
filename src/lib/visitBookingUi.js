// Ayudas de la pantalla pública "Agendar visita" (ficha de propiedad) — funciones
// puras para poder probarlas sin React.

import { toMinutes } from "./visitSlots";

// Código de error de book_visit() → clave de texto en scheduleVisit.booking.errors.
// Los de captura (invalid_*) se muestran junto a su campo; el resto, arriba del botón.
const ERROR_KEYS = {
  slot_unavailable: "slotTaken",
  rate_limited: "rateLimited",
  too_many_active: "tooManyActive",
  property_unavailable: "propertyUnavailable",
  invalid_slot: "slotTaken",
};

const FIELD_ERRORS = {
  invalid_name: "name",
  invalid_email: "email",
  invalid_phone: "phone",
  invalid_note: "note",
};

export function bookingErrorKey(code) {
  return ERROR_KEYS[code] || "generic";
}

// A qué campo del formulario pertenece un código de error de captura (o null).
export function bookingErrorField(code) {
  return FIELD_ERRORS[code] || null;
}

// "16:00" → "4:00 p. m." (o "4:00 PM" en inglés), según el idioma.
export function formatSlotTime(hora, locale = "es-MX") {
  const minutes = toMinutes(hora);
  if (!Number.isFinite(minutes)) return "";
  return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

// "2026-11-05" → "jue", "5", "nov." (partes para pintar el selector de días).
// Se calcula en UTC al mediodía para que la zona horaria del navegador no mueva el día.
export function slotDayParts(fecha, locale = "es-MX") {
  const date = new Date(`${fecha}T12:00:00Z`);
  const part = (options) => date.toLocaleDateString(locale, { ...options, timeZone: "UTC" });
  return { weekday: part({ weekday: "short" }), day: part({ day: "numeric" }), month: part({ month: "short" }) };
}

export function formatSlotDay(fecha, locale = "es-MX") {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

// El resultado de bookVisit() como "cita" para armar el archivo de calendario
// (citaToIcs): el título lleva la propiedad y el lugar es su dirección.
export function bookingToCalendarEvent(result, { titlePrefix = "Visita", note = "" } = {}) {
  const property = result.property || {};
  const label = property.code ? `${String(property.title).trim()} (${property.code})` : String(property.title || "").trim();
  return {
    id: result.token,
    titulo: `${titlePrefix}: ${label}`,
    fecha: result.fecha,
    hora: result.hora,
    duracion_min: result.duracion_min,
    lugar: property.address || "",
    actividades: String(note || "").trim() || null,
  };
}
