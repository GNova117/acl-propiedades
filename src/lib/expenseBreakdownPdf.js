// PDF del desglose de gastos (comprador o vendedor, de un municipio), sobre la
// hoja membretada de ACL. Solo dibuja lo que recibe ya calculado y traducido
// (`data`): los rubros de ese municipio y perfil y su total. No hay ningún dato
// de utilidad de la oficina en el PDF porque ni siquiera llega hasta aquí.
//
// Mismo patrón que visitReportPdf.js (hoja membretada + paginación
// automática); el ayudante de texto está duplicado a propósito para no tocar los
// generadores ya publicados.

const TEMPLATE_URL = "/plantilla_acl.pdf";

const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const TOP_Y = 628;
const BOTTOM_Y = 115;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const SIZE_TITLE = 14;
const SIZE_BODY = 10;
const SIZE_SMALL = 9;
const LINE_HEIGHT = 15;

// Columnas de la tabla: concepto | tarifa | monto (alineado a la derecha).
const COL_RATE_X = MARGIN_LEFT + 270;
const COL_AMOUNT_RIGHT = PAGE_WIDTH - MARGIN_RIGHT;
const CONCEPT_WIDTH = 255;
const RATE_WIDTH = 120;

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
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// data: {
//   title, profileLine, detailLines: string[], generatedLine,
//   colConcept, colRate, colAmount, totalLabel, total (texto), note, empty,
//   rows: [{ name, rate, amount }]   // rate y amount ya formateados
// }
export async function buildExpenseBreakdownPdf(data, { template } = {}) {
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
  const paragraph = async (text, { size = SIZE_BODY, color = black, font = regular } = {}) => {
    for (const line of wrapText(text, font, size, CONTENT_WIDTH)) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN_LEFT, y, size, font, color });
      y -= LINE_HEIGHT;
    }
  };
  const right = (text, font, size, rightX, yy) => {
    const value = sanitize(text);
    page.drawText(value, { x: rightX - font.widthOfTextAtSize(value, size), y: yy, size, font, color: black });
  };

  // ── Encabezado ──
  const title = sanitize(data.title);
  page.drawText(title, { x: MARGIN_LEFT, y, size: SIZE_TITLE, font: bold, color: black });
  page.drawLine({ start: { x: MARGIN_LEFT, y: y - 3 }, end: { x: MARGIN_LEFT + bold.widthOfTextAtSize(title, SIZE_TITLE), y: y - 3 }, thickness: 1, color: black });
  y -= LINE_HEIGHT * 2;
  await paragraph(data.profileLine, { size: 11, font: bold });
  for (const line of data.detailLines || []) await paragraph(line);
  await paragraph(data.generatedLine, { size: SIZE_SMALL, color: gray });
  y -= LINE_HEIGHT * 0.6;

  // ── Tabla ──
  const header = async () => {
    await ensureSpace(LINE_HEIGHT * 2);
    page.drawText(sanitize(data.colConcept), { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
    page.drawText(sanitize(data.colRate), { x: COL_RATE_X, y, size: SIZE_BODY, font: bold, color: black });
    right(data.colAmount, bold, SIZE_BODY, COL_AMOUNT_RIGHT, y);
    page.drawLine({ start: { x: MARGIN_LEFT, y: y - 4 }, end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: y - 4 }, thickness: 1, color: black });
    y -= LINE_HEIGHT * 1.4;
  };
  await header();

  if (!data.rows?.length) await paragraph(data.empty, { color: gray });

  for (const row of data.rows || []) {
    const nameLines = wrapText(row.name, regular, SIZE_BODY, CONCEPT_WIDTH);
    const rateLines = wrapText(row.rate, regular, SIZE_BODY, RATE_WIDTH);
    const height = Math.max(nameLines.length, rateLines.length) * LINE_HEIGHT;
    if (y - height < BOTTOM_Y) {
      await addPage();
      await header();
    }
    nameLines.forEach((line, i) => page.drawText(line, { x: MARGIN_LEFT, y: y - i * LINE_HEIGHT, size: SIZE_BODY, font: regular, color: black }));
    rateLines.forEach((line, i) => page.drawText(line, { x: COL_RATE_X, y: y - i * LINE_HEIGHT, size: SIZE_BODY, font: regular, color: gray }));
    right(row.amount, regular, SIZE_BODY, COL_AMOUNT_RIGHT, y);
    y -= height;
    page.drawLine({ start: { x: MARGIN_LEFT, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: y + 6 }, thickness: 0.5, color: hairline });
    y -= 5;
  }

  // ── Total ──
  await ensureSpace(LINE_HEIGHT * 3);
  y -= 4;
  page.drawLine({ start: { x: MARGIN_LEFT, y: y + 12 }, end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: y + 12 }, thickness: 1, color: black });
  page.drawText(sanitize(data.totalLabel), { x: MARGIN_LEFT, y, size: 11, font: bold, color: black });
  right(data.total, bold, 11, COL_AMOUNT_RIGHT, y);
  y -= LINE_HEIGHT * 2;
  await paragraph(data.note, { size: SIZE_SMALL, color: gray });

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

export async function downloadExpenseBreakdownPdf(data, filePrefix = "desglose-gastos") {
  const bytes = await buildExpenseBreakdownPdf(data);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
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
