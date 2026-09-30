// Corte mensual de las visitas: informe mensual por propiedad (lo que se le
// manda al propietario), resumen por asesor y el recordatorio de enviarlos.
// Funciones puras sobre datos ya cargados; el mes se lee en hora LOCAL, igual
// que el reporte mensual de la oficina (monthlyReport.js).

import { REJECTION_REASONS } from "./visitReport";

export const monthValue = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`; // month: 0-11

// "2026-09" → { year: 2026, month: 8 }; null si no tiene esa forma.
export function parseMonthValue(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ""));
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1 } : null;
}

export function previousMonthValue(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthValue(d.getFullYear(), d.getMonth());
}

// Los últimos `count` meses, del actual hacia atrás.
export function monthOptions(count = 12, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return monthValue(d.getFullYear(), d.getMonth());
  });
}

export function monthLabel(value, language) {
  const parsed = parseMonthValue(value);
  if (!parsed) return "";
  const name = new Date(parsed.year, parsed.month, 1).toLocaleDateString(language?.startsWith("en") ? "en-US" : "es-MX", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function inMonth(iso, value) {
  const parsed = parseMonthValue(value);
  if (!parsed || !iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === parsed.year && d.getMonth() === parsed.month;
}

// El mismo JSON del informe, solo con las visitas de ese mes. Los días en el
// mercado siguen siendo los acumulados de la propiedad (no los del mes).
export function monthPayload(payload, value) {
  return { ...payload, visits: (payload?.visits || []).filter((v) => inMonth(v.visited_at, value)) };
}

// Clientes atendidos = personas distintas: el mismo nombre (sin importar
// mayúsculas ni acentos) que visita dos veces cuenta una. Una visita sin
// nombre no se puede cruzar con otra, así que cuenta por sí sola.
const personKey = (visit) => {
  const name = String(visit.prospect_name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return name ? `n:${name}` : `v:${visit.id}`;
};

const reasonOrder = (key) => {
  const i = REJECTION_REASONS.indexOf(key);
  return i === -1 ? REJECTION_REASONS.length : i;
};

export function topReasons(visits) {
  const counts = new Map();
  for (const v of visits) for (const key of new Set(v.reasons || [])) counts.set(key, (counts.get(key) || 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || reasonOrder(a.key) - reasonOrder(b.key) || a.key.localeCompare(b.key));
}

// Una fila por asesor con visitas en el periodo (`value` null = todo el
// tiempo), de más a menos clientes atendidos.
export function advisorVisitStats(visits, value = null) {
  const scoped = value ? visits.filter((v) => inMonth(v.visited_at, value)) : visits;
  const byAdvisor = new Map();
  for (const v of scoped) {
    const key = v.advisor_id || "";
    if (!byAdvisor.has(key)) byAdvisor.set(key, []);
    byAdvisor.get(key).push(v);
  }
  return [...byAdvisor.entries()]
    .map(([advisorId, list]) => ({
      advisorId,
      visits: list.length,
      clients: new Set(list.map(personKey)).size,
      properties: new Set(list.map((v) => v.property_id)).size,
      interested: list.filter((v) => v.interest !== "descartado").length,
      offers: list.filter((v) => v.interest === "oferta_realizada").length,
      potential: list.filter((v) => v.potential_client).length,
    }))
    .sort((a, b) => b.clients - a.clients || b.visits - a.visits);
}

// ── Recordatorio mensual ───────────────────────────────────────────────
// Propiedades a las que hay que mandarles informe ese mes: las disponibles
// (aunque no hayan tenido visitas: "0 visitas" también es información para el
// propietario) y las que sí tuvieron visitas ese mes aunque ya no estén
// disponibles. Las inactivas no.
export function reportableProperties(properties, visits, value) {
  const visited = new Set(visits.filter((v) => inMonth(v.visited_at, value)).map((v) => v.property_id));
  return properties.filter((p) => p.active !== false && (p.status === "disponible" || visited.has(p.id)));
}

// "Ya le envié el informe de <mes> a <propiedad>" se guarda en este navegador
// (sin tabla ni SQL): si se limpia el navegador o se entra desde otro equipo,
// el recordatorio vuelve a aparecer, que es el lado seguro de equivocarse.
const sentKey = (value, propertyId) => `acl.visitReportSent.${value}.${propertyId}`;

export function isReportSent(value, propertyId) {
  try {
    return window.localStorage.getItem(sentKey(value, propertyId)) != null;
  } catch {
    return false;
  }
}

export function setReportSent(value, propertyId, sent) {
  try {
    if (sent) window.localStorage.setItem(sentKey(value, propertyId), new Date().toISOString());
    else window.localStorage.removeItem(sentKey(value, propertyId));
  } catch {
    // sin almacenamiento disponible: simplemente no se recuerda
  }
}
