// PDF firmado: el documento original SIN tocar + una "Hoja de firma electrónica"
// al final (sobre la hoja membretada de ACL) con el nombre, la fecha y hora, la
// IP, la firma, la huella (si se agregó) y el hash SHA-256 del original. Se arma
// al momento, en el navegador, a partir de lo guardado en la solicitud, así el
// original nunca se altera y el hash sigue siendo comprobable.

import { base64ToBytes } from "./signing";

const TEMPLATE_URL = "/plantilla_acl.pdf";
const MARGIN_LEFT = 60;
const CONTENT_WIDTH = 612 - 60 * 2;
const TOP_Y = 628;
const SIZE_BODY = 10;
const LINE_HEIGHT = 15;

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

const mexicoTime = (iso) =>
  new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long", timeStyle: "short" });

// `request`: la solicitud completa (document_b64, title, doc_sha256, signer_name,
// signed_name, signed_at, signer_ip, signer_agent, signature_b64, fingerprint_b64,
// fingerprint_by, fingerprint_at). `template` permite probar fuera del navegador.
export async function buildSignedPdf(request, { template } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const templateBytes =
    template ??
    (await fetch(TEMPLATE_URL).then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar la plantilla membretada");
      return res.arrayBuffer();
    }));

  const doc = await PDFDocument.load(base64ToBytes(request.document_b64));
  const templateDoc = await PDFDocument.load(templateBytes);
  const [copied] = await doc.copyPages(templateDoc, [0]);
  const page = doc.addPage(copied);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  let y = TOP_Y;

  const text = (value, { x = MARGIN_LEFT, size = SIZE_BODY, font = regular, color = black } = {}) => {
    page.drawText(sanitize(value), { x, y, size, font, color });
  };
  const paragraph = (value, opts = {}) => {
    for (const line of wrap(value, opts.font || regular, opts.size || SIZE_BODY, opts.width || CONTENT_WIDTH)) {
      text(line, opts);
      y -= (opts.size || SIZE_BODY) + 5;
    }
  };
  const row = (label, value) => {
    text(label, { font: bold });
    const lines = wrap(value || "-", regular, SIZE_BODY, CONTENT_WIDTH - 150);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN_LEFT + 150, y, size: SIZE_BODY, font: regular, color: black });
      y -= LINE_HEIGHT;
    }
    if (lines.length === 0) y -= LINE_HEIGHT;
  };

  const title = "HOJA DE FIRMA ELECTRONICA";
  text(title, { size: 14, font: bold });
  page.drawLine({ start: { x: MARGIN_LEFT, y: y - 3 }, end: { x: MARGIN_LEFT + bold.widthOfTextAtSize(title, 14), y: y - 3 }, thickness: 1, color: black });
  y -= 26;

  row("Documento", request.title);
  row("Firmante", request.signed_name || request.signer_name);
  if (request.signed_name && request.signer_name && request.signed_name.trim().toLowerCase() !== request.signer_name.trim().toLowerCase()) {
    row("Nombre registrado", request.signer_name);
  }
  row("Fecha y hora de firma", `${mexicoTime(request.signed_at)} (hora del centro de Mexico)`);
  row("Direccion IP", request.signer_ip || "No disponible");
  row("Navegador", request.signer_agent ? request.signer_agent.slice(0, 160) : "No disponible");
  y -= 4;

  text("Huella SHA-256 del documento original", { font: bold });
  y -= LINE_HEIGHT;
  const hash = request.doc_sha256 || "";
  text(hash.slice(0, 32), { font: mono, size: 9 });
  y -= 12;
  text(hash.slice(32), { font: mono, size: 9 });
  y -= 24;

  // Recuadros de firma y de huella
  const boxTop = y;
  const signW = 250;
  const printW = 150;
  const boxH = 100;
  const boxes = [
    { x: MARGIN_LEFT, w: signW, label: "Firma", image: request.signature_b64 },
    { x: MARGIN_LEFT + signW + 30, w: printW, label: "Huella dactilar", image: request.fingerprint_b64 },
  ];
  for (const box of boxes) {
    page.drawRectangle({ x: box.x, y: boxTop - boxH, width: box.w, height: boxH, borderColor: gray, borderWidth: 0.6 });
    page.drawText(box.label, { x: box.x, y: boxTop + 5, size: 9, font: bold, color: black });
    if (box.image) {
      const png = await doc.embedPng(base64ToBytes(box.image));
      const scale = Math.min((box.w - 12) / png.width, (boxH - 12) / png.height);
      const w = png.width * scale;
      const h = png.height * scale;
      page.drawImage(png, { x: box.x + (box.w - w) / 2, y: boxTop - boxH + (boxH - h) / 2, width: w, height: h });
    } else {
      page.drawText("Sin huella registrada", { x: box.x + 12, y: boxTop - boxH / 2, size: 9, font: regular, color: gray });
    }
  }
  y = boxTop - boxH - 14;
  if (request.fingerprint_b64 && request.fingerprint_at) {
    // Pie de la huella: quién y cuándo, ajustado al ancho del recuadro.
    const caption = `Huella capturada el ${mexicoTime(request.fingerprint_at)}${request.fingerprint_by ? `, registrada por ${request.fingerprint_by}` : ""}`;
    let cy = y;
    for (const line of wrap(caption, regular, 7, CONTENT_WIDTH - (signW + 30))) {
      page.drawText(line, { x: MARGIN_LEFT + signW + 30, y: cy, size: 7, font: regular, color: gray });
      cy -= 9;
    }
    y = Math.min(y, cy);
  }
  y -= 22;

  paragraph(
    "Esta hoja forma parte del documento y se anexa al final. La firma se capturo en pantalla y quedo registrada con fecha, hora y direccion IP. La huella SHA-256 permite comprobar que el documento original no cambio despues de firmarse.",
    { color: gray, size: 8 }
  );

  return doc.save();
}

const fileSafe = (text) =>
  sanitize(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);

export function signedPdfFileName(request) {
  return `${fileSafe(request.title) || "documento"}_firmado.pdf`;
}

export async function downloadSignedPdf(request) {
  const bytes = await buildSignedPdf(request);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = signedPdfFileName(request);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
