// Helpers compartidos por los dos extractores (CSF y acta): son lecturas
// APROXIMADAS por texto y expresiones regulares sobre un layout que el SAT o
// el registro civil pueden cambiar sin avisar — por eso cada extractor
// reporta qué campos no pudo leer (camposFaltantes) y nunca se trata el
// resultado como definitivo: el cliente confirma/corrige en pantalla y el
// estado automático nunca pasa de "requiere_revision" cuando algo falta.

const MONTHS = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

export const DATE_PATTERN = /(\d{1,2})[/\-\s](?:de\s)?([A-Za-zñÑ0-9]{2,12})[/\-\s](?:de\s)?(\d{2,4})/;

export function normalizeDate(day, monthRaw, year) {
  const month = /^\d+$/.test(monthRaw) ? monthRaw.padStart(2, "0") : MONTHS[monthRaw.toLowerCase()];
  if (!month || Number(month) > 12) return null;
  const y = year.length === 2 ? `20${year}` : year;
  const d = day.padStart(2, "0");
  const date = `${y}-${month}-${d}`;
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ? date : null;
}

// Toma el texto después de una etiqueta ("RFC:", "Domicilio Fiscal:"...)
// hasta la siguiente etiqueta conocida o una longitud máxima.
export function matchAfterLabel(text, labelPattern, { stopAt = /(RFC|CURP|Régimen|Regimen|Domicilio|Fecha|Nombre|Denominación|Denominacion|Estatus|Página|Pagina)\s*:?/i, maxLength = 160 } = {}) {
  const labelMatch = text.match(labelPattern);
  if (!labelMatch) return null;
  const start = labelMatch.index + labelMatch[0].length;
  const rest = text.slice(start, start + maxLength);
  const stopMatch = rest.search(stopAt);
  const value = (stopMatch === -1 ? rest : rest.slice(0, stopMatch)).trim();
  return value || null;
}

// Fecha más reciente que aparece después de una etiqueta dada, o la última
// fecha de todo el texto si la etiqueta no se encontró (en la práctica la
// fecha de emisión suele ser la última impresa en la hoja).
export function lastDateAfterLabel(text, labelPattern) {
  const labelMatch = text.match(labelPattern);
  const scope = labelMatch ? text.slice(labelMatch.index, labelMatch.index + 60) : text;
  const matches = [...scope.matchAll(new RegExp(DATE_PATTERN, "gi"))];
  const last = matches[matches.length - 1];
  return last ? normalizeDate(last[1], last[2], last[3]) : null;
}
