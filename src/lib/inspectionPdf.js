// PDF del cotejo de inspección, sobre la hoja membretada de ACL. Mismo patrón
// que visitReportPdf.js/propertyFichaPdf.js (hoja membretada + paginación
// automática); el ayudante de texto está duplicado a propósito, como en el
// resto de los generadores de este proyecto, para no acoplar uno a otro.
//
// Recibe las etiquetas ya traducidas (`labels`) en vez de leer i18n, así se
// puede probar fuera del navegador.

import { failedItems, INSPECTION_CATEGORIES } from "./propertyInspection";

const TEMPLATE_URL = "/plantilla_acl.pdf";

const STATUS_KEY = { verde: "green", amarillo: "yellow", rojo: "red" };

// Arma el objeto `labels` que pide buildInspectionPdf/downloadInspectionPdf a
// partir de i18n — factorizado aquí para que la lista y el formulario (los
// dos lugares desde donde se puede descargar el PDF) no dupliquen el mismo
// armado y se desincronicen entre sí.
export function buildInspectionLabels(t, i18n, inspection) {
  const formatDateTime = (iso) =>
    iso ? new Date(iso).toLocaleString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { dateStyle: "long", timeStyle: "short" }) : "";
  return {
    title: t("inspections.pdf.title", { folio: inspection.folio }),
    addressLine: t("inspections.pdf.addressLine", { address: inspection.direccion }),
    inspectorLine: t("inspections.pdf.inspectorLine", { inspector: inspection.inspector }),
    dateLine: t("inspections.pdf.dateLine", { date: formatDateTime(inspection.visited_at) }),
    generatedLine: t("inspections.pdf.generatedLine", { date: formatDateTime(new Date().toISOString()) }),
    statusLabel: (estatus) => t(`inspections.status.${STATUS_KEY[estatus]}`),
    statusNote: (estatus) => t(`inspections.status.${STATUS_KEY[estatus]}Note`),
    checklistTitle: t("inspections.pdf.checklistTitle"),
    categoryLabel: (key) => t(`inspections.categories.${key}`),
    criterioLabel: (category, key) => t(`inspections.checklist.${category}.${key}`),
    estadoLabel: (estado) => t(`inspections.estado.${estado}`),
    correctionsTitle: t("inspections.pdf.correctionsTitle"),
    correctionsEmpty: t("inspections.pdf.correctionsEmpty"),
    observationsTitle: t("inspections.pdf.observationsTitle"),
    observationsEmpty: t("inspections.pdf.observationsEmpty"),
    signatureTitle: t("inspections.pdf.signatureTitle"),
    signedByLine: (name, dateText) => t("inspections.pdf.signedByLine", { name: name || "—", date: dateText }),
    noSignature: t("inspections.pdf.noSignature"),
    formatDateTime,
  };
}

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

const STATUS_COLOR = { verde: [0.12, 0.56, 0.35], amarillo: [0.72, 0.53, 0.04], rojo: [0.75, 0.22, 0.17] };

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

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo descargar la imagen");
  return res.arrayBuffer();
}

async function embedAuto(doc, bytes) {
  const view = new Uint8Array(bytes);
  const isPng = view[0] === 0x89 && view[1] === 0x50;
  return isPng ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

// labels: {
//   title, addressLine, inspectorLine, dateLine, generatedLine,
//   statusLabel(estatus), statusNote(estatus),
//   checklistTitle, categoryLabel(key), criterioLabel(category,key), estadoLabel(estado),
//   correctionsTitle, correctionsEmpty,
//   observationsTitle, observationsEmpty,
//   signatureTitle, signedByLine(name, dateText), noSignature, formatDateTime(iso),
// }
export async function buildInspectionPdf(inspection, labels, { template } = {}) {
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
  const gray = rgb(0.38, 0.38, 0.38);
  const hairline = rgb(0.82, 0.82, 0.82);
  const pale = rgb(0.965, 0.965, 0.965);

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
  await drawParagraph(labels.addressLine, { size: SIZE_SUBTITLE, font: bold });
  await drawParagraph(labels.inspectorLine);
  await drawParagraph(labels.dateLine);
  await drawParagraph(labels.generatedLine, { size: SIZE_SMALL, color: gray });
  y -= LINE_HEIGHT * 0.4;

  // ── Estatus ──
  const statusRgb = rgb(...(STATUS_COLOR[inspection.estatus] || STATUS_COLOR.amarillo));
  await ensureSpace(46);
  page.drawRectangle({ x: MARGIN_LEFT, y: y - 34, width: CONTENT_WIDTH, height: 34, color: pale, borderColor: statusRgb, borderWidth: 1.2 });
  page.drawText(sanitize(labels.statusLabel(inspection.estatus)), { x: MARGIN_LEFT + 10, y: y - 15, size: SIZE_SUBTITLE + 1, font: bold, color: statusRgb });
  page.drawText(sanitize(labels.statusNote(inspection.estatus)), { x: MARGIN_LEFT + 10, y: y - 28, size: SIZE_SMALL, font: regular, color: gray });
  y -= 34 + LINE_HEIGHT * 1.2;

  // ── Checklist ──
  await drawSubtitle(labels.checklistTitle);
  const estadoColor = { si: rgb(0.12, 0.56, 0.35), no: rgb(0.75, 0.22, 0.17), na: gray };
  for (const cat of INSPECTION_CATEGORIES) {
    const rows = cat.items.map((item) => inspection.checklist.find((e) => e.category === cat.key && e.key === item.key)).filter(Boolean);
    if (rows.length === 0) continue;
    await ensureSpace(LINE_HEIGHT * 1.4);
    page.drawText(sanitize(labels.categoryLabel(cat.key)), { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
    y -= LINE_HEIGHT * 1.1;
    for (const row of rows) {
      const criterioLines = wrapText(labels.criterioLabel(row.category, row.key), regular, SIZE_SMALL, CONTENT_WIDTH - 60);
      await ensureSpace(criterioLines.length * 12 + 4);
      const estadoText = sanitize(labels.estadoLabel(row.estado));
      page.drawText(estadoText, { x: MARGIN_LEFT + CONTENT_WIDTH - 40, y, size: SIZE_SMALL, font: bold, color: estadoColor[row.estado] || black });
      criterioLines.forEach((line, i) => page.drawText(line, { x: MARGIN_LEFT + 10, y: y - i * 12, size: SIZE_SMALL, font: regular, color: black }));
      y -= criterioLines.length * 12 + 4;
    }
    y -= 4;
  }
  y -= LINE_HEIGHT * 0.6;

  // ── Detalles por corregir ──
  await drawSubtitle(labels.correctionsTitle);
  const failed = failedItems(inspection.checklist);
  if (failed.length === 0) {
    await drawParagraph(labels.correctionsEmpty, { color: gray });
  } else {
    for (const entry of failed) {
      await drawParagraph(`• ${labels.criterioLabel(entry.category, entry.key)}`, { size: SIZE_SMALL });
      const url = entry.signed_url || entry.file_path;
      if (url) {
        try {
          const bytes = await fetchBytes(url);
          const image = await embedAuto(doc, bytes);
          const thumbW = 90;
          const thumbH = (image.height / image.width) * thumbW;
          await ensureSpace(thumbH + 6);
          page.drawImage(image, { x: MARGIN_LEFT + 12, y: y - thumbH, width: thumbW, height: thumbH });
          y -= thumbH + 8;
        } catch {
          // La evidencia fotográfica es un plus del PDF, no algo que deba
          // tronar la descarga si una URL firmada ya venció o la red falla.
        }
      }
    }
  }
  y -= LINE_HEIGHT * 0.4;

  // ── Observaciones ──
  await drawSubtitle(labels.observationsTitle);
  await drawParagraph(inspection.observaciones || labels.observationsEmpty, { color: inspection.observaciones ? black : gray });
  y -= LINE_HEIGHT * 0.6;

  // ── Firma ──
  await drawSubtitle(labels.signatureTitle);
  if (inspection.signature_data) {
    try {
      const bytes = await fetchBytes(inspection.signature_data);
      const image = await embedAuto(doc, bytes);
      const sigW = 160;
      const sigH = (image.height / image.width) * sigW;
      await ensureSpace(sigH + LINE_HEIGHT * 1.5);
      page.drawImage(image, { x: MARGIN_LEFT, y: y - sigH, width: sigW, height: sigH });
      y -= sigH + 4;
      page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + sigW, y }, thickness: 0.75, color: hairline });
      y -= 12;
      await drawParagraph(labels.signedByLine(inspection.signed_by, labels.formatDateTime(inspection.updated_at || inspection.created_at)), { size: SIZE_SMALL, color: gray });
    } catch {
      await drawParagraph(labels.noSignature, { color: gray });
    }
  } else {
    await drawParagraph(labels.noSignature, { color: gray });
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

export async function downloadInspectionPdf(inspection, labels) {
  const bytes = await buildInspectionPdf(inspection, labels);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileSafe(`cotejo_${inspection.folio}`)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
