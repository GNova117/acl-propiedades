// Registro de visitas e informe para el vendedor. Funciones puras (sin React ni
// backend): las usan el panel del asesor, la página pública /informe/<token> y
// el PDF, así los tres muestran exactamente las mismas cifras. Nada de lo que
// se calcula aquí se guarda — se recalcula al vuelo de las visitas, así
// corregir o borrar una visita siempre deja el informe cuadrado.
//
// El informe que recibe el vendedor sale ya anonimizado desde la base de datos
// (visit_report / visit_report_by_token en schema.sql): cada visita trae solo
// { visited_at, interest, reasons, comments }. Este módulo nunca ve el nombre
// del prospecto ni las notas internas.

export const VISIT_INTERESTS = ["muy_interesado", "interesado", "oferta_realizada", "descartado"];

// "Interesados" = toda visita que no terminó en descartado. Se cuenta por
// VISITA, no por persona: quien visita dos veces cuenta dos, y así
// interesados + descartados siempre suman el total de visitas.
const INTERESTED = new Set(["muy_interesado", "interesado", "oferta_realizada"]);

export const isInterested = (interest) => INTERESTED.has(interest);

// Categorías del motivo de objeción o rechazo. Son claves de i18n
// (visits.reasons.*); la columna de la base es libre a propósito, así que
// agregar una categoría es solo agregarla aquí y en los dos idiomas.
export const REJECTION_REASONS = ["ubicacion", "precio", "espacios", "conservacion", "distribucion"];

// Nombre de un motivo con la función t de i18next. Una clave que no esté en los
// idiomas (una categoría agregada después, o un dato viejo) se muestra legible
// en vez de como la clave i18n cruda.
export const reasonLabel = (t, key) => t(`visits.reasons.${key}`, { defaultValue: String(key).replace(/_/g, " ") });

const pad = (n) => String(n).padStart(2, "0");

// Valor para <input type="datetime-local"> en HORA LOCAL: "2026-09-23T18:30".
export function toLocalInputValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const uniqueReasons = (list) => [...new Set((list || []).filter(Boolean))];

export const emptyVisitForm = (overrides = {}) => ({
  property_id: "",
  advisor_id: "",
  visited_at: toLocalInputValue(),
  prospect_name: "",
  interest: "",
  reasons: [],
  comments: "",
  internal_notes: "",
  ...overrides,
});

export function visitToForm(visit) {
  return {
    property_id: visit.property_id,
    advisor_id: visit.advisor_id || "",
    visited_at: toLocalInputValue(visit.visited_at),
    prospect_name: visit.prospect_name || "",
    interest: visit.interest,
    reasons: visit.reasons || [],
    comments: visit.comments || "",
    internal_notes: visit.internal_notes || "",
  };
}

// Una visita es un recorrido que YA ocurrió: se tolera un pequeño desfase del
// reloj del teléfono, no una fecha futura (que descuadraría el orden del
// historial y los días en el mercado).
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

// Errores de campo como { campo: "required" | "future" } — la pantalla los
// traduce a mensajes.
export function validateVisitForm(form, { now = new Date() } = {}) {
  const errors = {};
  if (!form.property_id) errors.property_id = "required";
  if (!form.advisor_id) errors.advisor_id = "required";
  const when = form.visited_at ? new Date(form.visited_at) : null;
  if (!when || Number.isNaN(when.getTime())) errors.visited_at = "required";
  else if (when.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) errors.visited_at = "future";
  if (!VISIT_INTERESTS.includes(form.interest)) errors.interest = "required";
  return errors;
}

export function toVisitFields(form) {
  return {
    property_id: form.property_id,
    advisor_id: form.advisor_id,
    visited_at: new Date(form.visited_at).toISOString(),
    prospect_name: form.prospect_name.trim() || null,
    interest: form.interest,
    reasons: uniqueReasons(form.reasons),
    comments: form.comments.trim() || null,
    internal_notes: form.internal_notes.trim() || null,
  };
}

// Enteros que suman EXACTAMENTE 100 (método del mayor residuo). Redondear cada
// uno por separado deja 33 + 33 + 33 = 99 con tres motivos iguales, y un
// informe que no suma 100 se ve como un error. Con enteros (n * 100 / total)
// no entra ruido de punto flotante.
export function percentages(counts) {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((n) => (n * 100) / total);
  const result = raw.map(Math.floor);
  const left = 100 - result.reduce((sum, n) => sum + n, 0);
  const byRemainder = raw.map((value, i) => ({ i, rem: value - result[i] })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; k < left; k++) result[byRemainder[k].i] += 1;
  return result;
}

// "2026-09-01" (una fecha sin hora, como viene de la columna date) → fecha
// LOCAL. new Date("2026-09-01") la leería como UTC y en México caería un día
// antes.
export function parseDateOnly(value) {
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Días naturales (calendario local) entre dos momentos, nunca negativos.
export function daysBetween(from, to = new Date()) {
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((end - start) / 86400000));
}

const reasonOrder = (key) => {
  const i = REJECTION_REASONS.indexOf(key);
  return i === -1 ? REJECTION_REASONS.length : i;
};

// payload = { property: {created_at, ...}, sold_on, visits: [{ visited_at,
// interest, reasons, comments }] } — la misma forma que devuelve el backend.
//
// Motivos: cada visita puede citar varios y cada motivo cuenta UNA vez por
// visita. El porcentaje es sobre el total de motivos mencionados (suma 100),
// no sobre las visitas: así la gráfica dice "de cada 10 objeciones, 4 son de
// precio", que es lo que le sirve al vendedor.
export function buildVisitReport(payload, { now = new Date() } = {}) {
  const property = payload?.property || {};
  const visits = (payload?.visits || []).slice().sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at));

  const counts = new Map();
  for (const visit of visits) {
    for (const key of new Set(visit.reasons || [])) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || reasonOrder(a.key) - reasonOrder(b.key) || a.key.localeCompare(b.key));
  const pcts = percentages(rows.map((row) => row.count));

  // Vendida: los días en el mercado se cuentan hasta la venta, no hasta hoy.
  const end = payload?.sold_on ? parseDateOnly(payload.sold_on) : now;

  return {
    daysOnMarket: property.created_at ? daysBetween(property.created_at, end) : null,
    sold: Boolean(payload?.sold_on),
    totalVisits: visits.length,
    interested: visits.filter((v) => isInterested(v.interest)).length,
    discarded: visits.filter((v) => v.interest === "descartado").length,
    withOffer: visits.filter((v) => v.interest === "oferta_realizada").length,
    reasons: rows.map((row, i) => ({ ...row, pct: pcts[i] })),
    reasonMentions: rows.reduce((sum, row) => sum + row.count, 0),
    log: visits,
  };
}

export function formatVisitDateTime(iso, language) {
  return new Date(iso).toLocaleString(language?.startsWith("en") ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export function formatVisitDate(iso, language) {
  return new Date(iso).toLocaleDateString(language?.startsWith("en") ? "en-US" : "es-MX", { dateStyle: "long" });
}

// ── Enlace privado ──────────────────────────────────────────────────────

// 32 hex = 128 bits aleatorios del generador criptográfico del navegador
// (getRandomValues sí existe también en http://192.168.x.x de una prueba en el
// teléfono, a diferencia de randomUUID). La base rechaza cualquier token que
// no cumpla este mismo patrón.
export const REPORT_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function generateReportToken() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const reportPath = (token) => `/informe/${token}`;

export function reportUrl(token, origin = typeof window !== "undefined" ? window.location.origin : "") {
  return `${origin}${reportPath(token)}`;
}
