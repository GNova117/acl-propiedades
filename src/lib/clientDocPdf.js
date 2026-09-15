import { isPdfDoc } from "./format";
import { db } from "./dataStore";

// Un documento de imagen (INE, CURP, etc.) siempre llega como jpeg desde
// DocumentCapture.jsx; para poder ofrecer "descargar en PDF" sin importar
// el tipo de documento se envuelve en un PDF de una sola página, con el
// mismo patrón de propertyFichaPdf.js (createImageBitmap + canvas → PNG,
// para no depender del formato original al pasarlo a pdf-lib).
async function imageBlobToPdfBytes(blob) {
  const { PDFDocument } = await import("pdf-lib");
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  const doc = await PDFDocument.create();
  const image = await doc.embedPng(pngBytes);
  const page = doc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return doc.save();
}

function fileSafe(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// Descarga cualquier documento de cliente (imagen o PDF ya existente) como
// un archivo .pdf. Uno que ya es PDF se descarga tal cual, sin volver a
// pasar por pdf-lib. Vuelve a pedir la URL firmada en vez de usar
// doc.signed_url directo — esa se generó al cargar la lista de documentos
// y expira a los 300s, así que para cuando el usuario da clic en
// "Descargar" puede llevar rato vencida.
export async function downloadClientDocumentAsPdf(doc, filePrefix) {
  const sourceUrl = await db.getClientDocumentUrl(doc);
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`No se pudo descargar el documento (${res.status})`);
  const sourceBlob = await res.blob();
  const pdfBlob = isPdfDoc(doc) ? sourceBlob : new Blob([await imageBlobToPdfBytes(sourceBlob)], { type: "application/pdf" });

  const objectUrl = URL.createObjectURL(pdfBlob);
  const stamp = doc.captured_at ? new Date(doc.captured_at) : new Date();
  const dateStamp = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${fileSafe(filePrefix)}_${dateStamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
