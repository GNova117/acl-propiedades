import { matchAfterLabel, DATE_PATTERN, normalizeDate } from "./textFields.js";

const CURP_PATTERN = /\b([A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2})\b/;

export function extractActaNacimientoFields(rawText) {
  const text = rawText.replace(/\s+/g, " ");
  const curp = text.match(CURP_PATTERN)?.[1] || null;
  const nombre = matchAfterLabel(text, /Nombre\s*\(?s?\)?:?/i, { maxLength: 120 });
  // "Folio" (gob.mx/actas) o "Cadena de verificación"/"Clave única"
  // (algunos registros civiles estatales la llaman distinto).
  const folio = matchAfterLabel(text, /(Folio|Cadena\s*de\s*verificaci[oó]n|Clave\s*[uú]nica):?/i, { maxLength: 80 });

  let fechaNacimiento = null;
  const labelMatch = text.match(/Fecha\s*de\s*Nacimiento:?/i);
  if (labelMatch) {
    const scope = text.slice(labelMatch.index, labelMatch.index + 60);
    const m = scope.match(DATE_PATTERN);
    if (m) fechaNacimiento = normalizeDate(m[1], m[2], m[3]);
  }

  return { curp, nombre, folio, fechaNacimiento };
}
