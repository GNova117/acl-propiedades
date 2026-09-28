// Reporte mensual: junta en un solo lugar lo que pasó en el mes (ventas, visitas,
// prospectos, estimaciones, firmas, mensajes, clientes nuevos) y lo compara con
// el mes anterior. Función pura sobre datos ya cargados. Un arreglo en `null` /
// ausente significa "este rol no tiene acceso a esos datos": esa sección se
// omite en vez de mostrarse en cero, para no aparentar que no pasó nada.
// Por diseño NO incluye utilidades ni datos de liquidaciones (son de los socios).

const INTERESTED = ["muy_interesado", "interesado", "oferta_realizada"];

export const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`; // month: 0-11

export function previousMonth(year, month) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

// ¿Esta fecha (ISO con hora, o solo "YYYY-MM-DD") cae en ese mes? Con hora se
// interpreta en la zona horaria del navegador (la de quien lee el reporte).
function inMonth(value, year, month) {
  if (!value) return false;
  const s = String(value);
  if (s.length <= 10) return s.slice(0, 7) === monthKey(year, month);
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
}

const count = (rows, pred) => (rows ? rows.filter(pred).length : null);

function countBy(rows, keyOf) {
  const map = new Map();
  for (const row of rows || []) {
    const key = keyOf(row);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map, ([key, total]) => ({ key, total })).sort((a, b) => b.total - a.total);
}

// Cifras planas de un mes (las que se comparan con el mes anterior).
function metrics(data, year, month) {
  const { ventas, properties, visits, prospects, history, estimates, signings, messages, clients } = data;
  const priceById = new Map((properties || []).map((p) => [p.id, Number(p.price) || 0]));
  const monthSales = ventas ? ventas.filter((v) => inMonth(v.fecha_venta, year, month)) : null;
  const closedIds = history ? new Set(history.filter((h) => h.stage === "cerrado" && inMonth(h.at, year, month)).map((h) => h.prospecto_id)) : null;
  const lostIds = history ? new Set(history.filter((h) => h.stage === "perdido" && inMonth(h.at, year, month)).map((h) => h.prospecto_id)) : null;
  // Un prospecto "cerrado" del mes debe seguir existiendo en la lista visible.
  const knownProspect = prospects ? new Set(prospects.map((p) => p.id)) : null;

  return {
    salesCount: monthSales ? monthSales.length : null,
    salesValue: monthSales ? monthSales.reduce((sum, v) => sum + (priceById.get(v.property_id) || 0), 0) : null,
    propertiesAdded: count(properties, (p) => inMonth(p.created_at, year, month)),
    visits: count(visits, (v) => inMonth(v.visited_at, year, month)),
    visitsInterested: count(visits, (v) => inMonth(v.visited_at, year, month) && INTERESTED.includes(v.interest)),
    visitsOffers: count(visits, (v) => inMonth(v.visited_at, year, month) && v.interest === "oferta_realizada"),
    prospectsCreated: count(prospects, (p) => inMonth(p.created_at, year, month)),
    prospectsClosed: closedIds && knownProspect ? Array.from(closedIds).filter((id) => knownProspect.has(id)).length : null,
    prospectsLost: lostIds && knownProspect ? Array.from(lostIds).filter((id) => knownProspect.has(id)).length : null,
    estimates: count(estimates, (e) => inMonth(e.created_at, year, month)),
    signaturesSent: count(signings, (s) => inMonth(s.created_at, year, month)),
    signaturesSigned: count(signings, (s) => s.signed_at && inMonth(s.signed_at, year, month)),
    messages: count(messages, (m) => inMonth(m.created_at, year, month)),
    clientsAdded: count(clients, (c) => inMonth(c.created_at, year, month)),
  };
}

export function buildMonthlyReport({ year, month, data }) {
  const prev = previousMonth(year, month);
  const current = metrics(data, year, month);
  const previous = metrics(data, prev.year, prev.month);

  const propertyById = new Map((data.properties || []).map((p) => [p.id, p]));
  const advisorById = new Map((data.advisors || []).map((a) => [a.id, a]));

  const sales = data.ventas
    ? data.ventas
        .filter((v) => inMonth(v.fecha_venta, year, month))
        .map((v) => ({
          date: String(v.fecha_venta).slice(0, 10),
          title: propertyById.get(v.property_id)?.title || "—",
          price: Number(propertyById.get(v.property_id)?.price) || 0,
          advisor: advisorById.get(v.advisor_id)?.name || "",
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : null;

  const monthProspects = data.prospects ? data.prospects.filter((p) => inMonth(p.created_at, year, month)) : null;
  const monthMessages = data.messages ? data.messages.filter((m) => inMonth(m.created_at, year, month)) : null;
  const monthVisits = data.visits ? data.visits.filter((v) => inMonth(v.visited_at, year, month)) : null;
  const monthEstimates = data.estimates ? data.estimates.filter((e) => inMonth(e.created_at, year, month)) : null;

  return {
    year,
    month,
    key: monthKey(year, month),
    previousKey: monthKey(prev.year, prev.month),
    current,
    previous,
    sales,
    prospectsBySource: monthProspects ? countBy(monthProspects, (p) => p.source || "manual") : null,
    visitsByInterest: monthVisits ? countBy(monthVisits, (v) => v.interest || "—") : null,
    messagesByChannel: monthMessages ? countBy(monthMessages, (m) => m.channel || "formulario") : null,
    estimatesByZone: monthEstimates ? countBy(monthEstimates, (e) => e.zone_name || "—").slice(0, 5) : null,
  };
}

// Cambio contra el mes anterior: { diff, pct } (pct null si el mes anterior fue 0 o no hay dato).
export function change(current, previous) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  return { diff, pct: previous > 0 ? Math.round((diff / previous) * 1000) / 10 : null };
}
