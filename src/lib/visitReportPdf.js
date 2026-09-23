// PDF del informe de visitas para el vendedor, sobre la hoja membretada de ACL:
// contadores, gráfica de motivos (barras dibujadas con rectángulos) e historial
// de observaciones. Sale del MISMO JSON anonimizado que la vista en pantalla
// (buildVisitReport), así que las cifras nunca difieren y nunca lleva nombres
// de prospectos ni notas internas — esos datos ni siquiera llegan hasta aquí.
//
// Mismo patrón que legalDocsPdf.js / perfilamientoPdf.js (hoja membretada +
// paginación automática); el ayudante de texto está duplicado a propósito para
// no tocar los generadores ya publicados. Recibe las etiquetas ya traducidas
// (`labels`) en vez de leer i18n: así se puede probar fuera del navegador.

import { buildVisitReport } from "./visitReport";

const TEMPLATE_URL = "/plantilla_acl.pdf";

const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const TOP_Y = 628;
const BOTTOM_Y = 115;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const SIZE_TITLE = 14;
const SIZE_SUBTITLE = 11;
const SIZE_BODY = 10;
const SIZE_SMALL = 9;
const LINE_HEIGHT = 15;

const SMART_CHARS = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };

function sanitize(text) {
  return String(text ?? "")
    .replace(/[‘’“”–—…]/g, (c) => SMART_CHARS[c])
    .replace(/[^\x20-\xFF\n]/g, "");
}

function wrapText(text, font, size, maxWidth) {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  const pushLongWord = (word) => {
    let chunk = "";
    for (const char of word) {
      if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = font.widthOfTextAtSize(word, size) > maxWidth ? pushLongWord(word) : word;
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// labels: {
//   title, propertyLine, zoneStatusLine, generatedLine,
//   summary, daysOnMarket, totalVisits, interested, discarded, withOfferNote (string|null), untilSale (string|null),
//   reasonsTitle, reasonsNote, reasonsEmpty, reasonLabel(key), reasonsPrefix,
//   logTitle, logNote, logEmpty, interestLabel(key), formatDateTime(iso)
// }
export async function buildVisitReportPdf(payload, labels, { template, now = new Date() } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const report = buildVisitReport(payload, { now });

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
  const gray = rgb(0.38, 0.38, 0.38);
  const hairline = rgb(0.82, 0.82, 0.82);
  const pale = rgb(0.965, 0.965, 0.965);
  const blue = rgb(0x2a / 255, 0x78 / 255, 0xd6 / 255); // ranura 1 de la paleta de la gráfica en pantalla

  let page = doc.getPages()[0];
  let y = TOP_Y;

  const addPage = async () => {
    const [copied] = await doc.copyPages(templateDoc, [0]);
    page = doc.addPage(copied);
    y = TOP_Y;
  };

  const ensureSpace = async (needed) => {
    if (y - needed < BOTTOM_Y) await addPage();
  };

  const drawTitle = async (text) => {
    await ensureSpace(LINE_HEIGHT * 2);
    const value = sanitize(text);
    page.drawText(value, { x: MARGIN_LEFT, y, size: SIZE_TITLE, font: bold, color: black });
    const width = bold.widthOfTextAtSize(value, SIZE_TITLE);
    page.drawLine({ start: { x: MARGIN_LEFT, y: y - 3 }, end: { x: MARGIN_LEFT + width, y: y - 3 }, thickness: 1, color: black });
    y -= LINE_HEIGHT * 2;
  };

  const drawSubtitle = async (text) => {
    await ensureSpace(LINE_HEIGHT * 2.4);
    page.drawText(sanitize(text).toUpperCase(), { x: MARGIN_LEFT, y, size: SIZE_SUBTITLE, font: bold, color: black });
    y -= LINE_HEIGHT * 1.3;
  };

  const drawParagraph = async (text, { size = SIZE_BODY, color = black, font = regular, x = MARGIN_LEFT, width = CONTENT_WIDTH, lineHeight = LINE_HEIGHT } = {}) => {
    for (const line of wrapText(text, font, size, width)) {
      await ensureSpace(lineHeight);
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
    }
  };

  // ── Encabezado ──
  await drawTitle(labels.title);
  await drawParagraph(labels.propertyLine, { size: SIZE_SUBTITLE, font: bold });
  if (labels.zoneStatusLine) await drawParagraph(labels.zoneStatusLine);
  await drawParagraph(labels.generatedLine, { size: SIZE_SMALL, color: gray });
  y -= LINE_HEIGHT * 0.6;

  // ── Contadores ──
  await drawSubtitle(labels.summary);
  const tiles = [
    { label: labels.daysOnMarket, value: report.daysOnMarket == null ? "-" : report.daysOnMarket, note: report.sold ? labels.untilSale : null },
    { label: labels.totalVisits, value: report.totalVisits },
    { label: labels.interested, value: report.interested, note: report.withOffer > 0 ? labels.withOfferNote : null },
    { label: labels.discarded, value: report.discarded },
  ];
  const tileGap = 10;
  const tileW = (CONTENT_WIDTH - tileGap * 3) / 4;
  const tileH = 56;
  await ensureSpace(tileH + 12);
  const tilesTop = y;
  tiles.forEach((tile, i) => {
    const x = MARGIN_LEFT + i * (tileW + tileGap);
    page.drawRectangle({ x, y: tilesTop - tileH, width: tileW, height: tileH, borderColor: hairline, borderWidth: 0.75, color: pale });
    page.drawText(sanitize(tile.label), { x: x + 8, y: tilesTop - 15, size: 8, font: regular, color: gray });
    page.drawText(sanitize(String(tile.value)), { x: x + 8, y: tilesTop - 38, size: 22, font: bold, color: black });
    if (tile.note) page.drawText(sanitize(tile.note), { x: x + 8, y: tilesTop - 50, size: 7.5, font: regular, color: gray });
  });
  y = tilesTop - tileH - LINE_HEIGHT * 1.2;

  // ── Motivos ──
  await drawSubtitle(labels.reasonsTitle);
  await drawParagraph(labels.reasonsNote, { size: 8.5, color: gray, lineHeight: 12 });
  y -= 4;
  if (report.reasons.length === 0) {
    await drawParagraph(labels.reasonsEmpty, { color: gray });
  } else {
    const labelW = 172;
    const barX = MARGIN_LEFT + labelW;
    const barMax = 200;
    const max = Math.max(1, ...report.reasons.map((r) => r.count));
    for (const row of report.reasons) {
      const labelLines = wrapText(labels.reasonLabel(row.key), regular, SIZE_SMALL, labelW - 10);
      const rowH = Math.max(20, labelLines.length * 11 + 8);
      await ensureSpace(rowH);
      labelLines.forEach((line, i) => page.drawText(line, { x: MARGIN_LEFT, y: y - 11 - i * 11, size: SIZE_SMALL, font: regular, color: black }));
      const barW = Math.max(2, (row.count / max) * barMax);
      page.drawLine({ start: { x: barX, y }, end: { x: barX, y: y - rowH }, thickness: 0.5, color: hairline });
      page.drawRectangle({ x: barX, y: y - 14, width: barW, height: 10, color: blue });
      page.drawText(sanitize(`${row.pct}%`), { x: barX + barW + 6, y: y - 12, size: SIZE_SMALL, font: bold, color: black });
      const pctW = bold.widthOfTextAtSize(sanitize(`${row.pct}%`), SIZE_SMALL);
      page.drawText(sanitize(` (${row.count})`), { x: barX + barW + 6 + pctW, y: y - 12, size: SIZE_SMALL, font: regular, color: gray });
      y -= rowH;
    }
  }
  y -= LINE_HEIGHT * 1.6;

  // ── Historial de observaciones ──
  await drawSubtitle(labels.logTitle);
  await drawParagraph(labels.logNote, { size: 8.5, color: gray, lineHeight: 12 });
  y -= 4;
  if (report.log.length === 0) {
    await drawParagraph(labels.logEmpty, { color: gray });
  } else {
    const lineH = 12.5;
    for (const visit of report.log) {
      const reasonsText = visit.reasons?.length ? `${labels.reasonsPrefix}: ${visit.reasons.map(labels.reasonLabel).join(", ")}` : null;
      const reasonLines = reasonsText ? wrapText(reasonsText, regular, SIZE_SMALL, CONTENT_WIDTH - 12) : [];
      const commentLines = visit.comments ? wrapText(visit.comments, regular, SIZE_BODY - 0.5, CONTENT_WIDTH - 12) : [];
      // Una visita no se parte entre dos páginas: se mide completa primero.
      await ensureSpace(14 + (reasonLines.length + commentLines.length) * lineH + 10);

      page.drawLine({ start: { x: MARGIN_LEFT, y: y + 4 }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: y + 4 }, thickness: 0.5, color: hairline });
      y -= 8;
      const when = sanitize(labels.formatDateTime(visit.visited_at));
      page.drawText(when, { x: MARGIN_LEFT, y, size: SIZE_SMALL, font: regular, color: gray });
      const whenW = regular.widthOfTextAtSize(when, SIZE_SMALL);
      page.drawText(sanitize(labels.interestLabel(visit.interest)), { x: MARGIN_LEFT + whenW + 12, y, size: SIZE_SMALL + 0.5, font: bold, color: black });
      y -= lineH;
      for (const line of reasonLines) {
        page.drawText(line, { x: MARGIN_LEFT + 12, y, size: SIZE_SMALL, font: regular, color: gray });
        y -= lineH;
      }
      for (const line of commentLines) {
        page.drawText(line, { x: MARGIN_LEFT + 12, y, size: SIZE_BODY - 0.5, font: regular, color: black });
        y -= lineH;
      }
      y -= 4;
    }
  }

  return doc.save();
}

function fileSafe(text) {
  return sanitize(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function downloadVisitReportPdf(payload, labels, filePrefix = "informe-visitas") {
  const bytes = await buildVisitReportPdf(payload, labels);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileSafe(filePrefix)}_${stamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
