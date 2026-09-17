// Expediente para avalúos: un solo PDF con los documentos del comprador (o
// los 2 compradores de un expediente conjunto) y del vendedor, en el orden
// que pide el valuador. Un documento que ya es PDF se anexa con sus páginas
// tal cual (copyPages); uno que es imagen se anexa como una página del
// tamaño de la imagen, con una etiqueta arriba que dice de quién es y qué
// documento es. La portada va sobre la hoja membretada (mismo patrón que
// perfilamientoPdf.js/legalDocsPdf.js) y se genera al final, cuando ya se
// sabe qué documentos entraron y cuáles faltaron.

import { db } from "./dataStore";
import { isPdfDoc } from "./format";
import { clientSheetData, clientSheetSections } from "./clientExpedienteFields";
import { buildPerfilamientoPdf } from "./perfilamientoPdf";

const TEMPLATE_URL = "/plantilla_acl.pdf";

const MARGIN_LEFT = 60;
const TOP_Y = 628;
const BOTTOM_Y = 115;

const SIZE_TITLE = 14;
const SIZE_SUBTITLE = 11;
const SIZE_BODY = 10;
const SIZE_CAPTION = 9;
const LINE_HEIGHT = 15;

// El orden del expediente lo define el valuador, no el catálogo de tipos de
// documento — por eso se lista aquí explícitamente y no se deriva de
// DOC_TYPES.
export const AVALUO_BUYER_DOCS = ["solicitud_avaluo", "ine", "acta_nacimiento", "cedula_fiscal", "curp"];
export const AVALUO_SELLER_DOCS = ["escrituras", "predial", "agua", "luz", "ine", "acta_nacimiento", "cedula_fiscal", "curp"];

// El expediente se arma por persona, no por tipo de documento: van juntos
// todos los documentos de cada quien, y de primero quien trae la solicitud
// de avalúo (es de quien se está haciendo el trámite).
const PRIORITY_DOC_TYPE = "solicitud_avaluo";

function orderedPeople(people) {
  const hasPriority = (person) => person.docs.some((d) => d.doc_type === PRIORITY_DOC_TYPE);
  // sort es estable: quien no trae la solicitud conserva el orden en que se
  // eligió en la pantalla.
  return [...people].sort((a, b) => Number(hasPriority(b)) - Number(hasPriority(a)));
}

const SMART_CHARS = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
};

// Las fuentes estándar de pdf-lib usan WinAnsi — cualquier carácter fuera de
// ese rango haría fallar drawText.
function sanitize(text) {
  return String(text ?? "")
    .replace(/[‘’“”–—…]/g, (c) => SMART_CHARS[c])
    .replace(/[^\x20-\xFF\n]/g, "");
}

function fileSafe(text) {
  return sanitize(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function fetchDocBytes(doc) {
  const url = await db.getClientDocumentUrl(doc);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

// Mismo camino que clientDocPdf.js: la imagen se normaliza a PNG con canvas
// para no depender del formato original al pasarla a pdf-lib.
async function imageBlobToPngBytes(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await pngBlob.arrayBuffer());
}

async function appendImageDoc(targetDoc, blob, caption, font) {
  const pngBytes = await imageBlobToPngBytes(blob);
  const image = await targetDoc.embedPng(pngBytes);
  const captionBand = LINE_HEIGHT * 1.6;
  const page = targetDoc.addPage([image.width, image.height + captionBand]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  page.drawText(sanitize(caption), {
    x: 6,
    y: image.height + captionBand / 2 - SIZE_CAPTION / 2,
    size: SIZE_CAPTION,
    font,
  });
}

async function appendPdfDoc(targetDoc, blob) {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = await targetDoc.copyPages(source, source.getPageIndices());
  pages.forEach((page) => targetDoc.addPage(page));
}

// Hoja membretada con los datos del cliente (contacto, NSS/contraseña del
// portal o número de crédito, y referencias) al frente de sus documentos.
// Reutiliza el generador del perfilamiento, que ya imprime "etiqueta: valor"
// por secciones sobre la plantilla y omite lo que está vacío.
async function appendClientSheet(targetDoc, client, sheetTitle) {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await buildPerfilamientoPdf(clientSheetData(client), clientSheetSections(client), {
    title: `${sheetTitle} - ${client.name}`,
  });
  const source = await PDFDocument.load(bytes);
  const pages = await targetDoc.copyPages(source, source.getPageIndices());
  pages.forEach((page) => targetDoc.addPage(page));
}

// `sections` es [{ title, docTypes, people: [{ client, docs }] }]; `docs` son
// los documentos de esa persona (varias filas por tipo es normal:
// client_documents es una fila por archivo).
async function buildBody(sections, docTypeLabel, labels) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const body = await PDFDocument.create();
  const font = await body.embedFont(StandardFonts.Helvetica);
  const contents = [];

  for (const section of sections) {
    for (const person of orderedPeople(section.people)) {
      const entry = (label, status, detail) => contents.push({ section: section.title, person: person.client.name, label, status, detail });

      try {
        await appendClientSheet(body, person.client, labels.clientSheet);
        entry(labels.clientSheet, "ok");
      } catch (err) {
        console.error("expedienteAvaluo: hoja de datos omitida", person.client.name, err);
        entry(labels.clientSheet, "error", err?.message || String(err));
      }

      for (const docType of section.docTypes) {
        const matches = person.docs.filter((d) => d.doc_type === docType);
        if (!matches.length) {
          entry(docTypeLabel(docType), "missing");
          continue;
        }
        for (const doc of matches) {
          const caption = `${section.title} · ${person.client.name} · ${docTypeLabel(docType)}`;
          try {
            const blob = await fetchDocBytes(doc);
            if (isPdfDoc(doc)) {
              await appendPdfDoc(body, blob);
            } else {
              await appendImageDoc(body, blob, caption, font);
            }
            entry(docTypeLabel(docType), "ok");
          } catch (err) {
            console.error("expedienteAvaluo: documento omitido", caption, err);
            entry(docTypeLabel(docType), "error", err?.message || String(err));
          }
        }
      }
    }
  }

  return { body, contents };
}

async function buildCover(contents, { title, sections, labels }) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const templateBytes = await fetch(TEMPLATE_URL).then((res) => {
    if (!res.ok) throw new Error("No se pudo cargar la plantilla membretada");
    return res.arrayBuffer();
  });

  const doc = await PDFDocument.load(templateBytes);
  const templateDoc = await PDFDocument.load(templateBytes);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const muted = rgb(0.45, 0.45, 0.45);

  let page = doc.getPages()[0];
  let y = TOP_Y;

  const newPage = async () => {
    const [copied] = await doc.copyPages(templateDoc, [0]);
    page = doc.addPage(copied);
    y = TOP_Y;
  };

  const write = async (text, { size = SIZE_BODY, font = regular, color = black, indent = 0, gap = LINE_HEIGHT } = {}) => {
    if (y - gap < BOTTOM_Y) await newPage();
    page.drawText(sanitize(text), { x: MARGIN_LEFT + indent, y, size, font, color });
    y -= gap;
  };

  const titleText = sanitize(title);
  page.drawText(titleText, { x: MARGIN_LEFT, y, size: SIZE_TITLE, font: bold, color: black });
  page.drawLine({
    start: { x: MARGIN_LEFT, y: y - 3 },
    end: { x: MARGIN_LEFT + bold.widthOfTextAtSize(titleText, SIZE_TITLE), y: y - 3 },
    thickness: 1,
    color: black,
  });
  y -= LINE_HEIGHT * 2;

  for (const section of sections) {
    await write(`${section.title}: ${orderedPeople(section.people).map((p) => p.client.name).join(", ")}`);
  }
  await write(`${labels.generatedOn}: ${new Date().toLocaleString()}`, { color: muted });
  y -= LINE_HEIGHT * 0.5;

  await write(labels.contents.toUpperCase(), { size: SIZE_SUBTITLE, font: bold, gap: LINE_HEIGHT * 1.4 });

  // El índice sigue el mismo agrupamiento que el PDF: sección, luego cada
  // persona con todos sus documentos.
  let currentSection = null;
  let currentPerson = null;
  for (const entry of contents) {
    if (entry.section !== currentSection) {
      currentSection = entry.section;
      currentPerson = null;
      await write(currentSection, { font: bold, gap: LINE_HEIGHT * 1.2 });
    }
    if (entry.person !== currentPerson) {
      currentPerson = entry.person;
      await write(currentPerson, { indent: 12, font: bold, gap: LINE_HEIGHT * 1.1 });
    }
    const mark = entry.status === "ok" ? "-" : "X";
    const suffix =
      entry.status === "missing" ? ` (${labels.missing})` : entry.status === "error" ? ` (${labels.failed}: ${entry.detail})` : "";
    await write(`${mark} ${entry.label}${suffix}`, {
      indent: 24,
      color: entry.status === "ok" ? black : muted,
    });
  }

  return doc;
}

// Devuelve los bytes del PDF final y el índice de lo que entró/faltó, para
// poder avisarlo en pantalla además de imprimirlo en la portada.
export async function buildExpedienteAvaluoPdf({ sections, docTypeLabel, labels, title }) {
  const { body, contents } = await buildBody(sections, docTypeLabel, labels);
  const doc = await buildCover(contents, { title, sections, labels });
  const bodyPages = await doc.copyPages(body, body.getPageIndices());
  bodyPages.forEach((page) => doc.addPage(page));
  return { bytes: await doc.save(), contents };
}

export async function downloadExpedienteAvaluoPdf(options) {
  const { bytes, contents } = await buildExpedienteAvaluoPdf(options);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const names = options.sections.flatMap((s) => orderedPeople(s.people).map((p) => p.client.name));
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `Expediente_avaluo_${names.map(fileSafe).join("_")}_${stamp}.pdf`.slice(0, 150);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return contents;
}
