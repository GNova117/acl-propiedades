// PDF descargable del Aviso de Privacidad / Carta de Derechos sobre la hoja
// membretada de ACL, con línea de firma al final. El contenido es el mismo
// texto que ya se publica en /aviso-de-privacidad y /carta-de-derechos (se
// lee de i18n, no se duplica aquí) — este módulo solo lo formatea para
// imprimir y hacer firmar. Reutiliza el mismo patrón de
// perfilamientoPdf.js (hoja membretada + paginación automática).

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
const LINE_HEIGHT = 15;

const SMART_CHARS = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
};

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

// `content` es el objeto de i18n tal cual (title/intro/updated/sections[] para
// el aviso de privacidad, o title/intro/items[]/footnote para la carta de
// derechos) — se acepta cualquiera de las dos formas sin necesitar dos
// funciones separadas. `template` permite inyectar bytes para pruebas fuera
// del navegador.
export async function buildLegalDocPdf(content, { template, signatureLabel = "Nombre y firma", dateLabel = "Fecha" } = {}) {
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
    page.drawLine({
      start: { x: MARGIN_LEFT, y: y - 3 },
      end: { x: MARGIN_LEFT + width, y: y - 3 },
      thickness: 1,
      color: black,
    });
    y -= LINE_HEIGHT * 2;
  };

  const drawSubtitle = async (text) => {
    await ensureSpace(LINE_HEIGHT * 1.6);
    const value = sanitize(text);
    page.drawText(value, { x: MARGIN_LEFT, y, size: SIZE_SUBTITLE, font: bold, color: black });
    y -= LINE_HEIGHT * 1.4;
  };

  const drawParagraph = async (text, { x = MARGIN_LEFT, width = CONTENT_WIDTH } = {}) => {
    for (const line of wrapText(text, regular, SIZE_BODY, width)) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x, y, size: SIZE_BODY, font: regular, color: black });
      y -= LINE_HEIGHT;
    }
  };

  const drawNumberedItem = async (number, text) => {
    const prefix = `${number}. `;
    const prefixWidth = bold.widthOfTextAtSize(prefix, SIZE_BODY);
    const lines = wrapText(text, regular, SIZE_BODY, CONTENT_WIDTH - prefixWidth);
    for (let i = 0; i < lines.length; i++) {
      await ensureSpace(LINE_HEIGHT);
      if (i === 0) page.drawText(prefix, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
      page.drawText(lines[i], { x: MARGIN_LEFT + prefixWidth, y, size: SIZE_BODY, font: regular, color: black });
      y -= LINE_HEIGHT;
    }
  };

  const drawSignatureBlock = async () => {
    await ensureSpace(LINE_HEIGHT * 4);
    y -= LINE_HEIGHT;
    const lineY = y;
    const gap = 40;
    const halfWidth = (CONTENT_WIDTH - gap) / 2;
    page.drawLine({ start: { x: MARGIN_LEFT, y: lineY }, end: { x: MARGIN_LEFT + halfWidth, y: lineY }, thickness: 1, color: black });
    page.drawText(sanitize(signatureLabel), { x: MARGIN_LEFT, y: lineY - 14, size: SIZE_BODY, font: regular, color: black });
    const dateX = MARGIN_LEFT + halfWidth + gap;
    page.drawLine({ start: { x: dateX, y: lineY }, end: { x: dateX + halfWidth, y: lineY }, thickness: 1, color: black });
    page.drawText(sanitize(dateLabel), { x: dateX, y: lineY - 14, size: SIZE_BODY, font: regular, color: black });
    y = lineY - 14 - LINE_HEIGHT;
  };

  await drawTitle(content.title);
  if (content.intro) {
    await drawParagraph(content.intro);
    y -= LINE_HEIGHT * 0.5;
  }
  if (content.updated) {
    await drawParagraph(content.updated);
    y -= LINE_HEIGHT * 0.5;
  }

  if (Array.isArray(content.sections)) {
    for (const section of content.sections) {
      await drawSubtitle(section.title.toUpperCase());
      await drawParagraph(section.body);
      y -= LINE_HEIGHT * 0.4;
    }
  }

  if (Array.isArray(content.items)) {
    for (let i = 0; i < content.items.length; i++) {
      await drawNumberedItem(i + 1, content.items[i]);
      y -= LINE_HEIGHT * 0.2;
    }
  }

  if (content.footnote) {
    y -= LINE_HEIGHT * 0.3;
    await drawParagraph(content.footnote);
  }

  await drawSignatureBlock();

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

export async function downloadLegalDocPdf(content, filePrefix) {
  const bytes = await buildLegalDocPdf(content);
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
