// Piezas compartidas de la Estimación de valor: textos del PDF, conversión de
// una fila del historial a los datos del PDF y el mensaje de WhatsApp. Las usan
// la página de estimación y la ficha del cliente.

import { formatArea, formatMXN, whatsappDigits } from "./format";

const PDF_LABEL_KEYS = ["title", "date", "zone", "reference", "range", "center", "breakdown", "landRate", "builtRate", "map", "mapAttribution", "disclaimer"];

export const valuationPdfLabels = (t) => Object.fromEntries(PDF_LABEL_KEYS.map((k) => [k, t(`valuation.pdf.${k}`)]));

// Una fila guardada trae todo lo necesario para rehacer el PDF tal cual se
// calculó, con los precios de ese día.
export const valuationRowToPdfData = (row) => ({
  zoneName: row.zone_name,
  reference: row.reference,
  date: row.created_at,
  landArea: Number(row.land_area),
  builtArea: Number(row.built_area),
  landRate: Number(row.land_rate),
  builtRate: Number(row.built_rate),
  spreadPct: Number(row.spread_pct),
  result: {
    low: Number(row.low),
    high: Number(row.high),
    center: Number(row.center),
    landValue: Number(row.land_value),
    builtValue: Number(row.built_value),
  },
  shapes: row.shapes || [],
});

// Enlace de WhatsApp con el resumen. Con teléfono abre el chat de esa persona;
// sin teléfono, WhatsApp deja elegir el contacto. Un número de 10 dígitos se
// toma como mexicano y se le antepone 52. El PDF no se puede adjuntar por
// enlace: se descarga aparte y se adjunta en el chat.
export function valuationWhatsappUrl(data, phone, labels) {
  const perM2 = "/ m²";
  const lines = [
    `*${labels.title} · ACL Propiedades*`,
    data.zoneName ? `${labels.zone}: ${data.zoneName}` : null,
    data.reference ? `${labels.reference}: ${data.reference}` : null,
    "",
    `*${labels.range}:* ${formatMXN(data.result.low)} - ${formatMXN(data.result.high)}`,
    `${labels.center}: ${formatMXN(data.result.center)}`,
    "",
    data.landArea > 0 ? `${labels.landRate}: ${formatArea(data.landArea)} x ${formatMXN(data.landRate)} ${perM2} = ${formatMXN(data.result.landValue)}` : null,
    data.builtArea > 0 ? `${labels.builtRate}: ${formatArea(data.builtArea)} x ${formatMXN(data.builtRate)} ${perM2} = ${formatMXN(data.result.builtValue)}` : null,
    "",
    `_${labels.disclaimer}_`,
  ].filter((line) => line !== null);

  let digits = whatsappDigits(phone);
  if (digits.length === 10) digits = `52${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
}
