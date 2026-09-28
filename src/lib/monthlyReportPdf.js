// PDF del reporte mensual sobre la hoja membretada de ACL. Recibe el reporte de
// monthlyReport.js y los textos ya traducidos (`labels`); pagina solo cuando el
// contenido no cabe en una hoja. Mismo patrón que los otros PDF (plantilla +
// pdf-lib cargado bajo demanda).

import { change } from "./monthlyReport";

const TEMPLATE_URL = "/plantilla_acl.pdf";
const MARGIN_LEFT = 60;
const CONTENT_WIDTH = 612 - 60 * 2;
const TOP_Y = 628;
const BOTTOM_Y = 115;
const ROW_H = 15;

const SMART_CHARS = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };
const sanitize = (text) =>
  String(text ?? "")
    .replace(/[‘’“”–—…]/g, (c) => SMART_CHARS[c])
    .replace(/[^\x20-\xFF\n]/g, "");

const mxn = (v) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const int = (v) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Number(v) || 0);

// Filas de indicadores en el orden del reporte. `money`: se muestra como pesos.
export const KPI_ROWS = [
  { key: "salesCount" },
  { key: "salesValue", money: true },
  { key: "propertiesAdded" },
  { key: "visits" },
  { key: "visitsInterested" },
  { key: "visitsOffers" },
  { key: "prospectsCreated" },
  { key: "prospectsClosed" },
  { key: "prospectsLost" },
  { key: "estimates" },
  { key: "signaturesSent" },
  { key: "signaturesSigned" },
  { key: "messages" },
  { key: "clientsAdded" },
];

export function formatChange(current, previous, money) {
  const ch = change(current, previous);
  if (!ch) return "-";
  if (ch.diff === 0) return "=";
  const sign = ch.diff > 0 ? "+" : "-";
  const amount = money ? mxn(Math.abs(ch.diff)) : int(Math.abs(ch.diff));
  // En pesos el porcentaje sobra (cifras grandes); en conteos sí ayuda.
  return `${sign}${amount}${!money && ch.pct != null ? ` (${ch.pct > 0 ? "+" : ""}${String(ch.pct).replace(".", ",")} %)` : ""}`;
}

export async function buildMonthlyReportPdf(report, labels, { template } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const templateBytes =
    template ??
    (await fetch(TEMPLATE_URL).then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar la plantilla membretada");
      return res.arrayBuffer();
    }));

  const doc = await PDFDocument.load(templateBytes);
  const templateDoc = await PDFDocument.load(templateBytes);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  let page = doc.getPages()[0];
  let y = TOP_Y;

  const ensureSpace = async (needed) => {
    if (y - needed >= BOTTOM_Y) return;
    const [copied] = await doc.copyPages(templateDoc, [0]);
    page = doc.addPage(copied);
    y = TOP_Y;
  };
  const text = (value, x, { size = 10, font = regular, color = black } = {}) => page.drawText(sanitize(value), { x, y, size, font, color });
  const clip = (value, width, size, font) => {
    let s = sanitize(value);
    while (s.length > 1 && font.widthOfTextAtSize(s, size) > width) s = s.slice(0, -1);
    return s;
  };

  const heading = async (value) => {
    // El encabezado se queda junto a por lo menos 3 filas de su lista.
    await ensureSpace(ROW_H * 4.5);
    y -= ROW_H * 0.6;
    text(value, MARGIN_LEFT, { size: 11, font: bold });
    page.drawLine({ start: { x: MARGIN_LEFT, y: y - 4 }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: y - 4 }, thickness: 0.6, color: gray });
    y -= ROW_H * 1.3;
  };

  // columns: [{ x, width }]; cells: strings
  const row = async (cells, columns, { fontStyle = regular, color = black } = {}) => {
    await ensureSpace(ROW_H);
    cells.forEach((cell, i) => text(clip(cell, columns[i].width, 10, fontStyle), columns[i].x, { font: fontStyle, color }));
    y -= ROW_H;
  };

  // Título
  const title = sanitize(labels.title).toUpperCase();
  text(title, MARGIN_LEFT, { size: 14, font: bold });
  page.drawLine({ start: { x: MARGIN_LEFT, y: y - 3 }, end: { x: MARGIN_LEFT + bold.widthOfTextAtSize(title, 14), y: y - 3 }, thickness: 1, color: black });
  y -= 24;
  text(labels.monthName, MARGIN_LEFT, { size: 12, font: bold });
  y -= ROW_H;
  text(labels.generated, MARGIN_LEFT, { size: 9, color: gray });
  y -= ROW_H * 0.6;

  // Indicadores contra el mes anterior
  const kpiCols = [
    { x: MARGIN_LEFT, width: 185 },
    { x: MARGIN_LEFT + 195, width: 80 },
    { x: MARGIN_LEFT + 285, width: 80 },
    { x: MARGIN_LEFT + 375, width: 117 },
  ];
  await heading(labels.kpiTitle);
  await row([labels.colConcept, labels.colThis, labels.colPrev, labels.colChange], kpiCols, { fontStyle: bold });
  for (const { key, money } of KPI_ROWS) {
    const cur = report.current[key];
    if (cur == null) continue;
    const prev = report.previous[key];
    const fmt = (v) => (v == null ? "-" : money ? mxn(v) : int(v));
    await row([labels.metrics[key], fmt(cur), fmt(prev), formatChange(cur, prev, money)], kpiCols);
  }

  // Listas por categoría (solo las que el rol puede ver y tienen datos)
  const listCols = [
    { x: MARGIN_LEFT, width: 380 },
    { x: MARGIN_LEFT + 400, width: 92 },
  ];
  const list = async (heading_, rows, nameOf) => {
    if (!rows || rows.length === 0) return;
    await heading(heading_);
    for (const r of rows) await row([nameOf(r.key), int(r.total)], listCols);
  };

  if (report.sales && report.sales.length > 0) {
    await heading(labels.salesTitle);
    const saleCols = [
      { x: MARGIN_LEFT, width: 62 },
      { x: MARGIN_LEFT + 68, width: 250 },
      { x: MARGIN_LEFT + 325, width: 80 },
      { x: MARGIN_LEFT + 410, width: 82 },
    ];
    for (const s of report.sales) {
      const [yy, mm, dd] = s.date.split("-");
      await row([`${dd}/${mm}/${yy}`, s.title, mxn(s.price), s.advisor], saleCols);
    }
  }
  await list(labels.prospectsBySourceTitle, report.prospectsBySource, (k) => labels.sources[k] || k);
  await list(labels.visitsByInterestTitle, report.visitsByInterest, (k) => labels.interests[k] || k);
  await list(labels.messagesByChannelTitle, report.messagesByChannel, (k) => labels.channels[k] || k);
  await list(labels.estimatesByZoneTitle, report.estimatesByZone, (k) => k);

  await ensureSpace(ROW_H * 3);
  y -= ROW_H;
  for (const line of sanitize(labels.note).match(/.{1,105}(\s|$)/g) || []) {
    text(line.trim(), MARGIN_LEFT, { size: 8, color: gray });
    y -= 11;
  }

  return doc.save();
}

export async function downloadMonthlyReportPdf(report, labels) {
  const bytes = await buildMonthlyReportPdf(report, labels);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Reporte_mensual_${report.key}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
