// Resumen semanal para los socios: arma, a partir de filas ya leídas, qué pasó
// en los últimos 7 días contra los 7 anteriores, y lo convierte en un correo.
// Todo aquí es puro (sin red ni base de datos) para poder probarlo con vitest;
// index.ts solo lee las tablas y manda el correo. Es JS plano a propósito:
// Deno lo importa tal cual y vitest también.
// Igual que el reporte mensual, NO incluye utilidades ni datos de liquidaciones.

export const TIMEZONE = "America/Mexico_City";
const DAY_MS = 86400000;
const INTERESTED = ["muy_interesado", "interesado", "oferta_realizada"];
// Mismos orígenes "entrantes" que src/lib/prospects.js (INBOUND_SOURCES): un
// prospecto que llegó solo y nadie ha contactado.
const INBOUND_SOURCES = ["whatsapp", "chatbot", "simulador", "estimacion", "comparador", "alerta", "sitio"];
const OPEN_STAGES = ["nuevo", "contactado", "interesado", "negociacion"];
const TOP_PROPERTIES = 5;
const TOP_SOURCES = 4;

export const SOURCE_LABELS = {
  sitio: "Sitio web",
  chatbot: "Chatbot",
  whatsapp: "WhatsApp",
  simulador: "Simulador de crédito",
  estimacion: "Vende tu casa",
  comparador: "Comparador de créditos",
  alerta: "Alertas de propiedades",
  manual: "Captura manual",
  visita: "Visitas",
  recomendacion: "Recomendación",
  redes: "Redes sociales",
  otro: "Otro",
};

// Fecha (YYYY-MM-DD) en la zona de México de un timestamp o de una fecha ya
// sin hora. Los reportes cuentan días de México, no de UTC: una visita a las
// 9 pm del domingo en Torreón es del domingo aunque en UTC ya sea lunes.
export function mxDate(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export function addDays(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// La semana que se reporta termina AYER (el reporte sale el lunes temprano y
// hoy apenas empieza) y dura 7 días; la anterior son los 7 días previos.
export function weekWindows(today) {
  const end = addDays(today, -1);
  const start = addDays(end, -6);
  return { current: { start, end }, previous: { start: addDays(start, -7), end: addDays(start, -1) } };
}

const within = (date, window) => Boolean(date) && date >= window.start && date <= window.end;

function metricsFor(data, window) {
  const priceById = new Map((data.properties || []).map((p) => [p.id, Number(p.price) || 0]));
  const sales = (data.ventas || []).filter((v) => within(mxDate(v.fecha_venta), window));
  const visits = (data.visits || []).filter((v) => within(mxDate(v.visited_at), window));
  const prospects = (data.prospects || []).filter((p) => within(mxDate(p.created_at), window));
  return {
    salesCount: sales.length,
    salesValue: sales.reduce((sum, v) => sum + (priceById.get(v.property_id) || 0), 0),
    propertiesAdded: (data.properties || []).filter((p) => within(mxDate(p.created_at), window)).length,
    visits: visits.length,
    visitsInterested: visits.filter((v) => INTERESTED.includes(v.interest)).length,
    visitsOffers: visits.filter((v) => v.interest === "oferta_realizada").length,
    prospectsNew: prospects.length,
    messages: (data.messages || []).filter((m) => within(mxDate(m.created_at), window)).length,
    views: (data.views || []).filter((v) => within(mxDate(v.viewed_on), window)).length,
  };
}

// Cambio porcentual contra la semana anterior; null si antes fue 0 (no hay
// base para comparar: "+100 %" desde cero no dice nada).
export function percentChange(current, previous) {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildWeeklyReport(data, today) {
  const windows = weekWindows(today);
  const current = metricsFor(data, windows.current);
  const previous = metricsFor(data, windows.previous);

  const weekProspects = (data.prospects || []).filter((p) => within(mxDate(p.created_at), windows.current));
  const bySource = new Map();
  for (const p of weekProspects) bySource.set(p.source || "otro", (bySource.get(p.source || "otro") || 0) + 1);

  const viewsByProperty = new Map();
  for (const v of data.views || []) {
    if (within(mxDate(v.viewed_on), windows.current)) viewsByProperty.set(v.property_id, (viewsByProperty.get(v.property_id) || 0) + 1);
  }
  const propertyById = new Map((data.properties || []).map((p) => [p.id, p]));
  const topViewed = Array.from(viewsByProperty, ([id, views]) => ({ id, views, property: propertyById.get(id) }))
    .filter((entry) => entry.property)
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_PROPERTIES)
    .map(({ id, views, property }) => ({ id, views, title: property.title, code: property.code || null }));

  const prospects = data.prospects || [];
  const properties = data.properties || [];
  return {
    windows,
    current,
    previous,
    changes: Object.fromEntries(Object.keys(current).map((key) => [key, percentChange(current[key], previous[key])])),
    prospectsBySource: Array.from(bySource, ([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_SOURCES),
    topViewed,
    inventory: {
      available: properties.filter((p) => p.active !== false && p.status === "disponible").length,
      reserved: properties.filter((p) => p.active !== false && p.status === "apartada").length,
    },
    attention: {
      unattended: prospects.filter((p) => p.stage === "nuevo" && !p.last_contact_at && INBOUND_SOURCES.includes(p.source)).length,
      overdueFollowUps: prospects.filter((p) => OPEN_STAGES.includes(p.stage) && p.next_followup_at && p.next_followup_at < today).length,
    },
  };
}

// ── Correo ───────────────────────────────────────────────────────────────────

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function formatRange({ start, end }) {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return sm === em ? `${sd} al ${ed} de ${MONTHS[em - 1]}` : `${sd} de ${MONTHS[sm - 1]} al ${ed} de ${MONTHS[em - 1]}`;
}

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function changeLabel(pct) {
  if (pct === null || pct === undefined) return "";
  if (pct === 0) return "igual que la semana anterior";
  return `${pct > 0 ? "+" : ""}${pct}% vs. semana anterior`;
}

export function reportRows(report) {
  const { current: c, changes } = report;
  return [
    { label: "Ventas cerradas", value: String(c.salesCount), change: changeLabel(changes.salesCount) },
    { label: "Valor de lo vendido", value: money(c.salesValue), change: changeLabel(changes.salesValue) },
    { label: "Propiedades nuevas en el inventario", value: String(c.propertiesAdded), change: changeLabel(changes.propertiesAdded) },
    { label: "Visitas a propiedades", value: String(c.visits), change: changeLabel(changes.visits) },
    { label: "Visitas con interés (incluye ofertas)", value: String(c.visitsInterested), change: changeLabel(changes.visitsInterested) },
    { label: "Ofertas realizadas", value: String(c.visitsOffers), change: changeLabel(changes.visitsOffers) },
    { label: "Prospectos nuevos", value: String(c.prospectsNew), change: changeLabel(changes.prospectsNew) },
    { label: "Mensajes del formulario de contacto", value: String(c.messages), change: changeLabel(changes.messages) },
    { label: "Vistas de fichas en el sitio (visitantes por propiedad y día)", value: String(c.views), change: changeLabel(changes.views) },
  ];
}

export function renderWeeklyEmail(report, { siteUrl = "https://acl-propiedades.vercel.app" } = {}) {
  const range = formatRange(report.windows.current);
  const subject = `Resumen semanal de ACL Propiedades: ${range}`;
  const rows = reportRows(report);

  const attention = [];
  if (report.attention.unattended > 0) attention.push(`${report.attention.unattended} prospecto(s) nuevo(s) que llegaron solos y nadie ha contactado`);
  if (report.attention.overdueFollowUps > 0) attention.push(`${report.attention.overdueFollowUps} seguimiento(s) de prospectos vencido(s)`);

  const td = "padding:8px 10px;border-bottom:1px solid #e2e6ec;";
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#12161c;max-width:640px;margin:0 auto;">
  <h2 style="margin:0 0 4px;">Resumen semanal</h2>
  <p style="margin:0 0 16px;color:#5a6472;">${escapeHtml(range)} · comparado con los 7 días anteriores</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${rows
      .map(
        (r) =>
          `<tr><td style="${td}">${escapeHtml(r.label)}</td><td style="${td}text-align:right;font-weight:bold;">${escapeHtml(r.value)}</td><td style="${td}color:#5a6472;font-size:12px;">${escapeHtml(r.change)}</td></tr>`,
      )
      .join("")}
  </table>
  ${
    report.prospectsBySource.length
      ? `<h3 style="margin:20px 0 6px;">De dónde llegaron los prospectos</h3><p style="margin:0;">${report.prospectsBySource
          .map((s) => `${escapeHtml(SOURCE_LABELS[s.source] || s.source)}: <b>${s.total}</b>`)
          .join(" · ")}</p>`
      : ""
  }
  ${
    report.topViewed.length
      ? `<h3 style="margin:20px 0 6px;">Propiedades más vistas</h3><ol style="margin:0;padding-left:20px;">${report.topViewed
          .map((p) => `<li><a href="${siteUrl}/propiedades/${escapeHtml(p.id)}">${escapeHtml(p.title)}</a>${p.code ? ` (${escapeHtml(p.code)})` : ""} — ${p.views} vista(s)</li>`)
          .join("")}</ol>`
      : ""
  }
  <h3 style="margin:20px 0 6px;">Inventario hoy</h3>
  <p style="margin:0;">${report.inventory.available} disponible(s) · ${report.inventory.reserved} apartada(s)</p>
  ${
    attention.length
      ? `<h3 style="margin:20px 0 6px;color:#c0392b;">Para atender</h3><ul style="margin:0;padding-left:20px;">${attention.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
      : ""
  }
  <p style="margin-top:28px;color:#888;font-size:12px;">Este resumen se envía cada lunes a quienes tienen el apartado Ventas y reportes. No incluye utilidades ni liquidaciones. Detalle en <a href="${siteUrl}/admin/reportes">el panel</a>.</p>
</div>`.trim();

  const text = [
    `Resumen semanal de ACL Propiedades — ${range}`,
    "",
    ...rows.map((r) => `${r.label}: ${r.value}${r.change ? ` (${r.change})` : ""}`),
    "",
    `Inventario hoy: ${report.inventory.available} disponible(s), ${report.inventory.reserved} apartada(s)`,
    ...(attention.length ? ["", "Para atender:", ...attention.map((a) => `- ${a}`)] : []),
  ].join("\n");

  return { subject, html, text };
}

// Destinatarios: la lista fija WEEKLY_REPORT_TO (separada por comas) si existe;
// si no, todos los correos con el apartado "reportes" (los mismos que ven
// /admin/reportes, así el resumen nunca llega a alguien sin acceso a esas cifras).
export function resolveRecipients(accessRows, override) {
  const emails = override
    ? String(override).split(",")
    : (accessRows || [])
        .filter((row) => {
          const role = Array.isArray(row.admin_roles) ? row.admin_roles[0] : row.admin_roles;
          return role?.sections?.includes("reportes");
        })
        .map((row) => row.email);
  return Array.from(new Set(emails.map((e) => String(e || "").trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))));
}
