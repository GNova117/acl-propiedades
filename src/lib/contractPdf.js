// Dibuja un documento de contractDocs.js sobre la hoja membretada de ACL:
// título, lugar y fecha, párrafos, tabla de datos, cláusulas numeradas y dos
// firmas lado a lado. Mismo patrón que legalDocsPdf.js (plantilla + paginación
// automática); los ayudantes están duplicados a propósito para no tocar el
// generador ya publicado.

const TEMPLATE_URL = "/plantilla_acl.pdf";
const MARGIN_LEFT = 60;
const CONTENT_WIDTH = 612 - 60 * 2;
const TOP_Y = 628;
const BOTTOM_Y = 115;
const SIZE_TITLE = 14;
const SIZE_BODY = 10;
const LINE_HEIGHT = 15;
const LABEL_WIDTH = 150;

const ORDINALS = ["PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA", "OCTAVA", "NOVENA", "DÉCIMA"];
const SMART_CHARS = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };

const sanitize = (text) =>
  String(text ?? "")
    .replace(/[‘’“”–—…]/g, (c) => SMART_CHARS[c])
    .replace(/[^\x20-\xFF\n]/g, "");

function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of sanitize(text).split(/\s+/).filter(Boolean)) {
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

export async function buildContractPdf(content, { template } = {}) {
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

  const paragraph = async (text, { x = MARGIN_LEFT, width = CONTENT_WIDTH, font = regular, color = black } = {}) => {
    for (const line of wrap(text, font, SIZE_BODY, width)) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x, y, size: SIZE_BODY, font, color });
      y -= LINE_HEIGHT;
    }
  };

  // Título subrayado
  await ensureSpace(LINE_HEIGHT * 2);
  const title = sanitize(content.title);
  page.drawText(title, { x: MARGIN_LEFT, y, size: SIZE_TITLE, font: bold, color: black });
  page.drawLine({
    start: { x: MARGIN_LEFT, y: y - 3 },
    end: { x: MARGIN_LEFT + bold.widthOfTextAtSize(title, SIZE_TITLE), y: y - 3 },
    thickness: 1,
    color: black,
  });
  y -= LINE_HEIGHT * 2;

  if (content.placeDate) {
    await paragraph(content.placeDate, { color: gray });
    y -= LINE_HEIGHT * 0.5;
  }
  for (const text of content.paragraphs || []) {
    await paragraph(text);
    y -= LINE_HEIGHT * 0.5;
  }

  // Tabla de datos: etiqueta en negritas + valor con ajuste de línea.
  if (content.data?.length) {
    y -= LINE_HEIGHT * 0.3;
    for (const [label, value] of content.data) {
      const lines = wrap(value || "-", regular, SIZE_BODY, CONTENT_WIDTH - LABEL_WIDTH);
      await ensureSpace(LINE_HEIGHT * lines.length);
      page.drawText(sanitize(label), { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
      for (const line of lines) {
        page.drawText(line, { x: MARGIN_LEFT + LABEL_WIDTH, y, size: SIZE_BODY, font: regular, color: black });
        y -= LINE_HEIGHT;
      }
    }
    y -= LINE_HEIGHT * 0.6;
  }

  // Cláusulas: "PRIMERA.- texto"
  for (let i = 0; i < (content.clauses || []).length; i++) {
    const prefix = `${ORDINALS[i] || i + 1}.- `;
    const prefixWidth = bold.widthOfTextAtSize(prefix, SIZE_BODY);
    const lines = wrap(content.clauses[i], regular, SIZE_BODY, CONTENT_WIDTH - prefixWidth);
    for (let j = 0; j < lines.length; j++) {
      await ensureSpace(LINE_HEIGHT);
      if (j === 0) page.drawText(prefix, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
      page.drawText(lines[j], { x: MARGIN_LEFT + prefixWidth, y, size: SIZE_BODY, font: regular, color: black });
      y -= LINE_HEIGHT;
    }
    y -= LINE_HEIGHT * 0.3;
  }

  // Firmas lado a lado
  await ensureSpace(LINE_HEIGHT * 6);
  y -= LINE_HEIGHT * 2.5;
  const gap = 40;
  const half = (CONTENT_WIDTH - gap) / 2;
  (content.signatures || []).slice(0, 2).forEach((sig, i) => {
    const x = MARGIN_LEFT + i * (half + gap);
    page.drawLine({ start: { x, y }, end: { x: x + half, y }, thickness: 1, color: black });
    let ly = y - 14;
    for (const line of wrap(sig.label, bold, SIZE_BODY, half)) {
      page.drawText(line, { x, y: ly, size: SIZE_BODY, font: bold, color: black });
      ly -= 12;
    }
    for (const line of wrap(sig.name || "", regular, SIZE_BODY, half)) {
      page.drawText(line, { x, y: ly, size: SIZE_BODY, font: regular, color: black });
      ly -= 12;
    }
  });

  return doc.save();
}

const fileSafe = (text) =>
  sanitize(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

export async function downloadContractPdf(content, options) {
  const bytes = await buildContractPdf(content, options);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileSafe(content.fileName)}_${stamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
