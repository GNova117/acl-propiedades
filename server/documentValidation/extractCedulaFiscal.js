import { matchAfterLabel, lastDateAfterLabel } from "./textFields.js";

// Persona física (4 letras + 6 dígitos + 3 alfanuméricos) o moral (3 letras).
const RFC_PATTERN = /\b([A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3})\b/;

// El QR de la Constancia de Situación Fiscal apunta siempre al validador del
// propio SAT — si se pudo leer el QR, esto es lo único que se comprueba (no
// se vuelve a consultar el sitio del SAT: ver Módulo D/adapter para eso).
export const SAT_QR_HOST_PATTERN = /siat\.sat\.gob\.mx/i;

export function extractCedulaFiscalFields(rawText) {
  const text = rawText.replace(/\s+/g, " ");
  const rfc = text.match(RFC_PATTERN)?.[1] || null;
  const nombre =
    matchAfterLabel(text, /Denominaci[oó]n\s*\/?\s*Raz[oó]n\s*Social:?/i, { maxLength: 200 }) ||
    matchAfterLabel(text, /Nombre\s*\(?s?\)?:?/i, { maxLength: 120 });
  const regimen = matchAfterLabel(text, /R[eé]gimen(?:es)?:?/i, { maxLength: 200 });
  const domicilioFiscal = matchAfterLabel(text, /Domicilio\s*Fiscal:?/i, { maxLength: 220 });
  const fechaEmision = lastDateAfterLabel(text, /emisi[oó]n:?/i);

  return { rfc, nombre, regimen, domicilioFiscal, fechaEmision };
}
