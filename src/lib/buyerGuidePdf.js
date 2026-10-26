// "Guía del comprador" en PDF sobre la hoja membretada de ACL (mismo patrón
// que legalDocsPdf.js, pero con listas y sin bloque de firma).
import { sanitize, wrapText } from "./propertyFichaPdf";
import { BUYER_GUIDE } from "./buyerGuide";

const TEMPLATE_URL = "/plantilla_acl.pdf";
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const TOP_Y = 628;
const BOTTOM_Y = 115;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const SIZE_TITLE = 16;
const SIZE_SUBTITLE = 11;
const SIZE_BODY = 10;
const SIZE_SMALL = 8.5;
const LINE_HEIGHT = 15;
const BULLET_INDENT = 14;

// `template` permite inyectar los bytes de la plantilla (pruebas fuera del
// navegador); en la app se descarga desde /public.
export async function buildBuyerGuidePdf({ template, guide = BUYER_GUIDE } = {}) {
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
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.35, 0.35, 0.35);

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

  const text = async (value, { font = regular, size = SIZE_BODY, x = MARGIN_LEFT, width = CONTENT_WIDTH, color = black } = {}) => {
    for (const line of wrapText(value, font, size, width)) {
      await ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x, y, size, font, color });
      y -= LINE_HEIGHT;
    }
  };

  const heading = async (value) => {
    // El título de la sección no se queda solo al pie de una página.
    await ensureSpace(LINE_HEIGHT * 3.5);
    page.drawText(sanitize(value), { x: MARGIN_LEFT, y, size: SIZE_SUBTITLE, font: bold, color: black });
    y -= LINE_HEIGHT * 1.4;
  };

  // Cada elemento lleva su marca ("•" o "1.") y las líneas siguientes quedan
  // alineadas con el texto, no con la marca.
  const listItem = async (marker, value) => {
    const markerWidth = Math.max(BULLET_INDENT, bold.widthOfTextAtSize(marker, SIZE_BODY) + 4);
    const lines = wrapText(value, regular, SIZE_BODY, CONTENT_WIDTH - markerWidth);
    for (let i = 0; i < lines.length; i++) {
      await ensureSpace(LINE_HEIGHT);
      if (i === 0) page.drawText(marker, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
      page.drawText(lines[i], { x: MARGIN_LEFT + markerWidth, y, size: SIZE_BODY, font: regular, color: black });
      y -= LINE_HEIGHT;
    }
    y -= 2;
  };

  page.drawText(sanitize(guide.title), { x: MARGIN_LEFT, y, size: SIZE_TITLE, font: bold, color: black });
  y -= LINE_HEIGHT * 1.3;
  await text(guide.subtitle, { font: italic, size: SIZE_SUBTITLE, color: grey });
  y -= LINE_HEIGHT * 0.5;
  await text(guide.intro);
  y -= LINE_HEIGHT * 0.8;

  for (const section of guide.sections) {
    await heading(section.title);
    for (const paragraph of section.paragraphs || []) await text(paragraph);
    for (const bullet of section.bullets || []) await listItem("•", bullet);
    for (let i = 0; i < (section.numbered || []).length; i++) await listItem(`${i + 1}.`, section.numbered[i]);
    if (section.note) {
      y -= 2;
      await text(section.note, { font: italic, color: grey });
    }
    y -= LINE_HEIGHT * 0.8;
  }

  await heading(guide.contactTitle);
  for (const line of guide.contact) await text(line);
  y -= LINE_HEIGHT * 0.8;
  await text(guide.disclaimer, { font: italic, size: SIZE_SMALL, color: grey });

  return doc.save();
}

export async function downloadBuyerGuidePdf() {
  const bytes = await buildBuyerGuidePdf();
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Guia_del_comprador_ACL_Propiedades.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
