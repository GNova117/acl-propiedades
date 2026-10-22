// Código QR de una propiedad para letreros y volantes: quien lo escanea cae en
// la ficha pública (fotos, precio, botón de contacto). Todo se arma en el
// navegador. El QR se dibuja con rectángulos (en el PDF como vectores), no como
// una imagen, para que salga nítido sin importar el tamaño al que se imprima.

import qrcode from "qrcode-generator";
import { ACL_LOGO_ACCENT_COLOR, ACL_LOGO_ACCENT_PATH, ACL_LOGO_BASE_COLOR, ACL_LOGO_BASE_PATH, ACL_LOGO_VIEWBOX } from "./aclLogoPaths";
import { formatMXN } from "./format";
import { OFFICE_WHATSAPP } from "./office";
import { fileSafe, sanitize, wrapText } from "./propertyFichaPdf";
import { propertyUrl } from "./socialPost";

const TEMPLATE_URL = "/plantilla_acl.pdf";

// Corrección de errores "Q" (25 %): aguanta un letrero sucio, rayado o con sol
// mejor que la "M" de costumbre, a cambio de unos módulos más.
const ERROR_LEVEL = "Q";
// Módulos de margen blanco alrededor (el estándar pide 4; sin él muchos lectores fallan).
export const QUIET_ZONE = 4;

// A dónde lleva el QR: la ficha pública con parámetros de campaña. Google
// Analytics (si el sitio lo tiene activado) toma utm_source=qr como fuente de
// la visita, así se ve cuánta gente llega escaneando cada letrero (utm_campaign
// es el código de la propiedad). No cambia la página que se abre.
export function qrTargetUrl(property, origin) {
  const campaign = encodeURIComponent(property.code || property.id);
  return `${propertyUrl(property, origin)}?utm_source=qr&utm_medium=impreso&utm_campaign=${campaign}`;
}

// Matriz del QR: { size, dark(row, col) }. Cabe cualquier URL razonable (hasta ~1,000 caracteres).
export function qrMatrix(text) {
  const qr = qrcode(0, ERROR_LEVEL);
  qr.addData(String(text));
  qr.make();
  const size = qr.getModuleCount();
  const cells = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => qr.isDark(r, c)));
  return { size, dark: (row, col) => cells[row]?.[col] === true };
}

// Tramos continuos de módulos oscuros por fila: [{ row, col, length }]. Dibujar
// un rectángulo por tramo (y no uno por módulo) evita las líneas finas que
// algunos visores de PDF dejan entre cuadros pegados.
export function darkRuns(matrix) {
  const runs = [];
  for (let row = 0; row < matrix.size; row++) {
    let col = 0;
    while (col < matrix.size) {
      if (!matrix.dark(row, col)) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < matrix.size && matrix.dark(row, col)) col += 1;
      runs.push({ row, col: start, length: col - start });
    }
  }
  return runs;
}

// Logo de ACL en el centro del QR. Un QR con corrección de errores "Q" se sigue
// leyendo aunque se tape una parte, pero poco: el logo (con un marco blanco de
// 1 módulo para que se despegue del dibujo) ocupa ~5 % del área y queda lejos
// de las tres esquinas con los cuadros de orientación. Medidas en módulos,
// sin contar el margen blanco del QR. No se ensancha más: cada punto de área
// que se tapa es margen de lectura que se pierde (en un letrero sucio o al sol).
const LOGO_WIDTH_RATIO = 0.28; // ancho del logo / ancho del QR
const LOGO_PADDING = 1; // módulos de marco blanco alrededor

export function logoPlate(matrix) {
  const logoW = matrix.size * LOGO_WIDTH_RATIO;
  const logoH = (logoW * ACL_LOGO_VIEWBOX.height) / ACL_LOGO_VIEWBOX.width;
  const w = logoW + LOGO_PADDING * 2;
  const h = logoH + LOGO_PADDING * 2;
  const x = (matrix.size - w) / 2;
  const y = (matrix.size - h) / 2;
  return { x, y, w, h, logoX: x + LOGO_PADDING, logoY: y + LOGO_PADDING, logoW, logoH, area: (w * h) / (matrix.size * matrix.size) };
}

// QR en un canvas con su margen blanco; `scale` = píxeles por módulo. Con
// `logo` (por omisión sí) lleva el logo de ACL al centro.
export function qrCanvas(matrix, { scale = 12, logo = true } = {}) {
  const total = (matrix.size + QUIET_ZONE * 2) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = total;
  canvas.height = total;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = "#000000";
  for (const { row, col, length } of darkRuns(matrix)) {
    ctx.fillRect((col + QUIET_ZONE) * scale, (row + QUIET_ZONE) * scale, length * scale, scale);
  }
  if (logo) {
    const plate = logoPlate(matrix);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect((plate.x + QUIET_ZONE) * scale, (plate.y + QUIET_ZONE) * scale, plate.w * scale, plate.h * scale);
    ctx.save();
    // Del viewBox del logo a píxeles: se recorta a la caja del dibujo y se escala al ancho que le toca.
    const k = (plate.logoW * scale) / ACL_LOGO_VIEWBOX.width;
    ctx.translate((plate.logoX + QUIET_ZONE) * scale, (plate.logoY + QUIET_ZONE) * scale);
    ctx.scale(k, k);
    ctx.translate(-ACL_LOGO_VIEWBOX.x, -ACL_LOGO_VIEWBOX.y);
    ctx.fillStyle = ACL_LOGO_ACCENT_COLOR;
    ctx.fill(new Path2D(ACL_LOGO_ACCENT_PATH), "evenodd");
    ctx.fillStyle = ACL_LOGO_BASE_COLOR;
    ctx.fill(new Path2D(ACL_LOGO_BASE_PATH), "evenodd");
    ctx.restore();
  }
  return canvas;
}

const STATUS_HEADING = { vendida: "VENDIDA", apartada: "APARTADA" };

export function signHeading(property) {
  return STATUS_HEADING[property.status] || (property.operation_type === "renta" ? "SE RENTA" : "SE VENDE");
}

const OFFICE_PHONE_TEXT = `${OFFICE_WHATSAPP.slice(2, 5)} ${OFFICE_WHATSAPP.slice(5, 8)} ${OFFICE_WHATSAPP.slice(8)}`;

// Letrero listo para imprimir (carta) sobre la hoja membretada de ACL: "SE
// VENDE", el nombre, la zona y el precio, y el QR grande al centro. El
// encabezado azul de la plantilla llega hasta y≈653 y su pie desde y≈115.
// `template`: bytes de la plantilla (pruebas fuera del navegador).
export async function buildQrSignPdf(property, { origin, template, logo = true } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const templateBytes =
    template ??
    (await fetch(TEMPLATE_URL).then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar la plantilla membretada");
      return res.arrayBuffer();
    }));
  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const { width: pageWidth } = page.getSize();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const centered = (text, y, size, font) => {
    const value = sanitize(text);
    page.drawText(value, { x: (pageWidth - font.widthOfTextAtSize(value, size)) / 2, y, size, font, color: black });
  };

  let y = 622;
  centered(signHeading(property), y, 36, bold);
  y -= 34;
  for (const line of wrapText(property.title, bold, 18, pageWidth - 120).slice(0, 2)) {
    centered(line, y, 18, bold);
    y -= 22;
  }
  const rent = property.operation_type === "renta";
  centered([property.zone, `${formatMXN(property.price)}${rent ? " al mes" : ""}`].filter(Boolean).join("  -  "), y - 2, 15, regular);

  // QR: cuadro blanco de 300 pt (con su margen) centrado, y los módulos como vectores.
  const matrix = qrMatrix(qrTargetUrl(property, origin));
  const box = 300;
  const boxX = (pageWidth - box) / 2;
  const boxTop = y - 28;
  const module = box / (matrix.size + QUIET_ZONE * 2);
  page.drawRectangle({ x: boxX, y: boxTop - box, width: box, height: box, color: rgb(1, 1, 1) });
  for (const { row, col, length } of darkRuns(matrix)) {
    page.drawRectangle({
      x: boxX + (col + QUIET_ZONE) * module,
      y: boxTop - (row + QUIET_ZONE + 1) * module,
      width: length * module,
      height: module,
      color: black,
    });
  }

  if (logo) {
    const plate = logoPlate(matrix);
    const plateX = boxX + (plate.x + QUIET_ZONE) * module;
    const plateTop = boxTop - (plate.y + QUIET_ZONE) * module;
    page.drawRectangle({ x: plateX, y: plateTop - plate.h * module, width: plate.w * module, height: plate.h * module, color: rgb(1, 1, 1) });
    // El logo es vectorial: drawSvgPath toma el origen del viewBox en (x, y) con el eje Y hacia abajo.
    const k = (plate.logoW * module) / ACL_LOGO_VIEWBOX.width;
    const logoAt = { x: boxX + (plate.logoX + QUIET_ZONE) * module - ACL_LOGO_VIEWBOX.x * k, y: boxTop - (plate.logoY + QUIET_ZONE) * module + ACL_LOGO_VIEWBOX.y * k };
    const hex = (c) => rgb(parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255);
    page.drawSvgPath(ACL_LOGO_ACCENT_PATH, { ...logoAt, scale: k, color: hex(ACL_LOGO_ACCENT_COLOR) });
    page.drawSvgPath(ACL_LOGO_BASE_PATH, { ...logoAt, scale: k, color: hex(ACL_LOGO_BASE_COLOR) });
  }

  const below = boxTop - box - 22;
  centered("Escanea para ver fotos, precio y agendar tu visita", below, 14, bold);
  centered([property.code, `WhatsApp ${OFFICE_PHONE_TEXT}`].filter(Boolean).join("   |   "), below - 20, 11, regular);

  return doc.save();
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const baseName = (property) => fileSafe(property.code || property.title) || "Propiedad";

export async function downloadQrSignPdf(property, options) {
  const bytes = await buildQrSignPdf(property, options);
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), `Letrero_QR_${baseName(property)}.pdf`);
}

export async function downloadQrPng(property, origin, { logo = true } = {}) {
  const canvas = qrCanvas(qrMatrix(qrTargetUrl(property, origin)), { scale: 24, logo });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");
  downloadBlob(blob, `QR_${baseName(property)}.png`);
}
