// Generación del PDF de perfilamiento (vendedor o comprador) sobre la hoja
// membretada de ACL. No se dibuja el membrete a mano: se carga
// public/plantilla_acl.pdf (que ya trae logo, marca de agua y pie) y se
// escribe el texto encima. Genérico por secciones — cualquier tipo de
// perfilamiento nuevo reutiliza esta misma función.

import { displayValue, isFieldVisible } from "./perfilamientoShared";

const TEMPLATE_URL = "/plantilla_acl.pdf";

// Área útil de la hoja membretada (medida sobre la plantilla real):
// el encabezado azul termina cerca de y=660 y el pie empieza cerca de y=80.
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const TOP_Y = 645;
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

// Las fuentes estándar de pdf-lib usan WinAnsi: acentos, ñ y ² están bien,
// pero cualquier carácter fuera de ese rango haría fallar drawText.
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

// `template` permite inyectar los bytes de la plantilla (se usa para probar la
// generación fuera del navegador); en la app se descarga desde /public.
export async function buildPerfilamientoPdf(data, sections, { title = "PERFILAMIENTO", template } = {}) {
  // pdf-lib se carga solo cuando de verdad se genera un PDF, para no meterlo
  // en el bundle que descarga todo visitante del sitio público.
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
    await ensureSpace(LINE_HEIGHT * 2);
    const value = sanitize(text);
    const width = bold.widthOfTextAtSize(value, SIZE_SUBTITLE);
    page.drawText(value, { x: (PAGE_WIDTH - width) / 2, y, size: SIZE_SUBTITLE, font: bold, color: black });
    y -= LINE_HEIGHT * 1.6;
  };

  const drawField = async (label, value) => {
    const labelText = `${sanitize(label)}: `;
    const labelWidth = regular.widthOfTextAtSize(labelText, SIZE_BODY);
    const valueText = sanitize(value);
    const inlineWidth = CONTENT_WIDTH - labelWidth;

    // Si el valor cabe junto a la etiqueta, va en la misma línea.
    if (bold.widthOfTextAtSize(valueText, SIZE_BODY) <= inlineWidth) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(labelText, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: regular, color: black });
      page.drawText(valueText, { x: MARGIN_LEFT + labelWidth, y, size: SIZE_BODY, font: bold, color: black });
      y -= LINE_HEIGHT;
      return;
    }

    // Si no, la etiqueta va sola y el valor se parte en varias líneas debajo.
    await ensureSpace(LINE_HEIGHT);
    page.drawText(labelText, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: regular, color: black });
    y -= LINE_HEIGHT;

    for (const line of wrapText(valueText, bold, SIZE_BODY, CONTENT_WIDTH - 12)) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN_LEFT + 12, y, size: SIZE_BODY, font: bold, color: black });
      y -= LINE_HEIGHT;
    }
  };

  const drawFields = async (fields) => {
    for (const field of fields) {
      if (!isFieldVisible(field, data)) continue;
      const value = displayValue(field, data);
      if (!value) continue; // los campos vacíos no se imprimen
      await drawField(field.label, value);
    }
  };

  await drawTitle(title);

  let first = true;
  for (const section of sections) {
    const hasContent = section.fields.some((f) => isFieldVisible(f, data) && displayValue(f, data));
    if (section.optional && !hasContent) continue;

    if (!first) y -= LINE_HEIGHT * 0.5;
    first = false;

    await drawSubtitle(section.title.toUpperCase());
    await drawFields(section.fields);
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

export function perfilamientoFileName(nombre, prefix = "Perfilamiento") {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const safeName = fileSafe(nombre || "Sin_nombre") || "Sin_nombre";
  return `${prefix}_${safeName}_${stamp}.pdf`;
}

// Genera y dispara la descarga en el navegador (equivalente a
// Content-Type: application/pdf + Content-Disposition: attachment).
// `fileNombre`/`filePrefix` arman el nombre del archivo por separado del
// título impreso en el PDF (que viene en `options.title`).
export async function downloadPerfilamientoPdf(data, sections, options, fileNombre, filePrefix) {
  const bytes = await buildPerfilamientoPdf(data, sections, options);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = perfilamientoFileName(fileNombre, filePrefix);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
