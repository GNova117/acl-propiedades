// Selección de propiedades en un solo enlace (/seleccion/<token>): el asesor arma una selección, manda UN enlace y ve
// cuándo la abrió el cliente. Funciones puras; la pantalla de armado, la ficha del prospecto y la página pública solo
// las pintan. Los datos viven en property_selections (ver supabase/schema.sql) o en el modo demo (localBackend).
import { isOpenStage } from "./prospects";

export const MAX_SELECTION = 12; // propiedades por selección (igual que la restricción de la tabla)
export const TITLE_MAX = 120;
export const NOTE_MAX = 500;
export const SELECTION_VALID_DAYS = 60; // vigencia del enlace (igual que expires_at por omisión en la tabla)
export const OPEN_CUE_DAYS = 7; // cuánto tiempo se destaca «abrió la selección» si no se le ha vuelto a contactar
export const SUGGESTED_PICKS = 5; // cuántas de las que le encajan a un prospecto vienen marcadas de entrada

const DAY_MS = 864e5;
const ms = (value) => {
  if (value == null || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

export const selectionUrl = (origin, token) => `${origin}/seleccion/${token}`;

// Título de partida: «Propiedades para Ana» (el asesor lo puede cambiar).
export const defaultSelectionTitle = (recipientName) => (firstName(recipientName) ? `Propiedades para ${firstName(recipientName)}` : "Propiedades para ti");

// Agrega o quita una propiedad de la selección; no pasa de MAX_SELECTION ni repite.
export function togglePick(ids, id, max = MAX_SELECTION) {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= max ? ids : [...ids, id];
}

// Las que vienen marcadas al armar desde un prospecto: sus mejores coincidencias (ya vienen ordenadas, las más nuevas primero).
export const suggestedPicks = (matches, limit = SUGGESTED_PICKS) => matches.slice(0, Math.min(limit, MAX_SELECTION)).map((p) => p.id);

// revoked (la desactivó el asesor) | expired (venció) | opened (el cliente la abrió) | sent (todavía sin abrir)
export function selectionState(selection, now = new Date()) {
  if (selection.revoked_at) return "revoked";
  const expires = ms(selection.expires_at);
  if (expires != null && expires < now.getTime()) return "expired";
  return Number(selection.open_count) > 0 ? "opened" : "sent";
}

// Las selecciones de un prospecto, la más reciente primero.
export const selectionsFor = (prospectId, selections) =>
  (selections || []).filter((s) => s.prospecto_id === prospectId).sort((a, b) => (ms(b.created_at) ?? 0) - (ms(a.created_at) ?? 0));

// La selección que el prospecto abrió y por la que conviene escribirle: la abrió hace poco (OPEN_CUE_DAYS), sigue vigente y
// nadie le ha contactado desde entonces. Solo prospectos en etapas abiertas. null si no hay.
export function openedSelection(prospect, selections, now = new Date()) {
  if (!isOpenStage(prospect.stage)) return null;
  const lastContact = ms(prospect.last_contact_at);
  let best = null;
  for (const s of selectionsFor(prospect.id, selections)) {
    if (selectionState(s, now) !== "opened") continue;
    const opened = ms(s.last_opened_at);
    if (opened == null || now.getTime() - opened > OPEN_CUE_DAYS * DAY_MS) continue;
    if (lastContact != null && lastContact >= opened) continue;
    if (!best || opened > ms(best.last_opened_at)) best = s;
  }
  return best;
}

// «hace 5 minutos», «hace 2 horas», «ayer», «hace 3 días» en el idioma de la pantalla.
export function agoText(at, locale = "es", now = new Date()) {
  const time = ms(at);
  if (time == null) return "";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const seconds = Math.max(0, Math.round((now.getTime() - time) / 1000));
  if (seconds < 60) return rtf.format(0, "second");
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  return rtf.format(-Math.floor(seconds / 86400), "day");
}

// Lo que se guarda al crear una selección (limpio y dentro de los límites de la tabla).
export function cleanSelectionInput({ propertyIds, title, note }) {
  const ids = [...new Set(propertyIds || [])].slice(0, MAX_SELECTION);
  return {
    property_ids: ids,
    title: String(title || "").trim().slice(0, TITLE_MAX) || null,
    note: String(note || "").trim().slice(0, NOTE_MAX) || null,
  };
}
