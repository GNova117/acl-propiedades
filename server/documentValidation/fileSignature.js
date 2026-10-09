// Tipo real de archivo por los primeros bytes (magic bytes) — nunca se
// confía en la extensión ni en el Content-Type que declara el navegador,
// ambos los puede mentir quien sube el archivo.
const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
};

export function detectFileType(buffer) {
  for (const [type, bytes] of Object.entries(SIGNATURES)) {
    if (bytes.every((b, i) => buffer[i] === b)) return type;
  }
  return null;
}

export function isAllowedDocumentFile(buffer) {
  return detectFileType(buffer) === "pdf";
}

export function isAllowedBackupImageFile(buffer) {
  const type = detectFileType(buffer);
  return type === "jpeg" || type === "png";
}

// Heurística barata contra PDFs maliciosos: Vercel no tiene un antivirus
// real disponible, así que solo se descartan los objetos que un lector de
// PDF normal no necesita para una constancia/acta (JavaScript embebido,
// acciones automáticas, archivos adjuntos). Un PDF legítimo del SAT o de
// gob.mx no trae ninguno de estos.
const SUSPICIOUS_PDF_TOKENS = ["/JavaScript", "/JS", "/OpenAction", "/Launch", "/EmbeddedFile", "/RichMedia"];

export function hasSuspiciousPdfObjects(buffer) {
  const text = buffer.toString("latin1");
  return SUSPICIOUS_PDF_TOKENS.some((token) => text.includes(token));
}
