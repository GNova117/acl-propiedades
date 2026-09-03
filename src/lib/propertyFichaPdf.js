// Ficha técnica en PDF de una propiedad: datos generales sobre la hoja
// membretada de ACL, más las fotos de la propiedad y las fotos de los
// asesores asignados. A diferencia de perfilamientoPdf.js (solo texto),
// esta necesita incrustar imágenes, así que no comparte ese módulo aunque
// reutiliza el mismo patrón de hoja membretada + paginación.

import { formatMXN, formatArea } from "./format";

const TEMPLATE_URL = "/plantilla_acl.pdf";

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
const IMAGE_GAP = 10;
const IMAGE_ROW_MAX_HEIGHT = 180;
const ADVISOR_PHOTO_SIZE = 70;

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

// Convierte cualquier imagen que el navegador pueda decodificar (jpg, png,
// webp, etc. — lo que se haya subido desde ImageUploader o guardado como
// foto de asesor) a PNG vía canvas, para incrustarla con pdf-lib sin
// depender del formato original. Si una imagen falla (URL rota, formato no
// soportado), se omite en vez de tronar toda la ficha.
async function embedImageFromUrl(doc, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) return null;
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    return await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

function fitImage(img, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
  return { width: img.width * scale, height: img.height * scale };
}

// `template` permite inyectar los bytes de la plantilla (pruebas fuera del
// navegador); en la app se descarga desde /public.
export async function buildFichaTecnicaPdf(property, { typeLabel, statusLabel, template } = {}) {
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

    if (bold.widthOfTextAtSize(valueText, SIZE_BODY) <= inlineWidth) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(labelText, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: regular, color: black });
      page.drawText(valueText, { x: MARGIN_LEFT + labelWidth, y, size: SIZE_BODY, font: bold, color: black });
      y -= LINE_HEIGHT;
      return;
    }

    await ensureSpace(LINE_HEIGHT);
    page.drawText(labelText, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: regular, color: black });
    y -= LINE_HEIGHT;

    for (const line of wrapText(valueText, bold, SIZE_BODY, CONTENT_WIDTH - 12)) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN_LEFT + 12, y, size: SIZE_BODY, font: bold, color: black });
      y -= LINE_HEIGHT;
    }
  };

  const drawParagraph = async (text) => {
    for (const line of wrapText(text, regular, SIZE_BODY, CONTENT_WIDTH)) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: regular, color: black });
      y -= LINE_HEIGHT;
    }
  };

  const drawImageRow = async (imgs) => {
    const boxWidth = imgs.length === 1 ? CONTENT_WIDTH : (CONTENT_WIDTH - IMAGE_GAP) / 2;
    const fitted = imgs.map((img) => fitImage(img, boxWidth, IMAGE_ROW_MAX_HEIGHT));
    const rowHeight = Math.max(...fitted.map((f) => f.height));
    await ensureSpace(rowHeight);
    let x = MARGIN_LEFT;
    imgs.forEach((img, i) => {
      const { width, height } = fitted[i];
      page.drawImage(img, { x, y: y - height, width, height });
      x += boxWidth + IMAGE_GAP;
    });
    y -= rowHeight + IMAGE_GAP;
  };

  const drawAdvisorBlock = async (advisor) => {
    const photoImg = advisor.photo_url ? await embedImageFromUrl(doc, advisor.photo_url) : null;
    const lines = [
      advisor.name,
      advisor.phone ? `Tel: ${advisor.phone}` : null,
      advisor.email ? `Correo: ${advisor.email}` : null,
      advisor.whatsapp ? `WhatsApp: ${advisor.whatsapp}` : null,
    ].filter(Boolean);
    const textHeight = lines.length * LINE_HEIGHT;
    const blockHeight = Math.max(photoImg ? ADVISOR_PHOTO_SIZE : 0, textHeight);

    await ensureSpace(blockHeight);
    const blockTopY = y;

    if (photoImg) {
      const fitted = fitImage(photoImg, ADVISOR_PHOTO_SIZE, ADVISOR_PHOTO_SIZE);
      page.drawImage(photoImg, { x: MARGIN_LEFT, y: blockTopY - fitted.height, width: fitted.width, height: fitted.height });
    }

    const textX = MARGIN_LEFT + ADVISOR_PHOTO_SIZE + 12;
    let ty = blockTopY;
    lines.forEach((line, i) => {
      page.drawText(sanitize(line), { x: textX, y: ty, size: SIZE_BODY, font: i === 0 ? bold : regular, color: black });
      ty -= LINE_HEIGHT;
    });

    y = blockTopY - blockHeight - IMAGE_GAP;
  };

  await drawTitle("FICHA TECNICA DE LA PROPIEDAD");
  await drawSubtitle(sanitize(property.title).toUpperCase());

  await drawField("Tipo", typeLabel);
  await drawField("Estado", statusLabel);
  await drawField("Zona", property.zone);
  await drawField("Direccion", property.address);
  await drawField("Precio", formatMXN(property.price));
  await drawField("Superficie", formatArea(property.area_m2));
  if (property.bedrooms != null) await drawField("Recamaras", String(property.bedrooms));
  if (property.bathrooms != null) await drawField("Banos", String(property.bathrooms));
  if (property.parking != null) await drawField("Estacionamientos", String(property.parking));

  if (property.description) {
    y -= LINE_HEIGHT * 0.5;
    await drawSubtitle("DESCRIPCION");
    await drawParagraph(property.description);
  }

  y -= LINE_HEIGHT * 0.5;
  await drawSubtitle("FOTOGRAFIAS");
  const imageUrls = property.images || [];
  if (imageUrls.length === 0) {
    await drawParagraph("Sin fotografias registradas.");
  } else {
    const embedded = [];
    for (const url of imageUrls) {
      const img = await embedImageFromUrl(doc, url);
      if (img) embedded.push(img);
    }
    if (embedded.length === 0) {
      await drawParagraph("No fue posible cargar las fotografias registradas.");
    } else {
      for (let i = 0; i < embedded.length; i += 2) {
        await drawImageRow(embedded.slice(i, i + 2));
      }
    }
  }

  y -= LINE_HEIGHT * 0.5;
  await drawSubtitle("ASESOR(ES) ASIGNADO(S)");
  const advisors = property.advisors || [];
  if (advisors.length === 0) {
    await drawParagraph("Sin asesor asignado.");
  } else {
    for (const advisor of advisors) {
      await drawAdvisorBlock(advisor);
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

// Genera y dispara la descarga en el navegador, igual que
// downloadPerfilamientoPdf en perfilamientoPdf.js.
export async function downloadFichaTecnicaPdf(property, options) {
  const bytes = await buildFichaTecnicaPdf(property, options);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const safeName = fileSafe(property.title) || "Propiedad";
  const link = document.createElement("a");
  link.href = url;
  link.download = `FichaTecnica_${safeName}_${stamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
