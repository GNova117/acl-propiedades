// Genera el PDF de la Solicitud de avalúo escribiendo los datos capturados
// directamente SOBRE el formato oficial de INFONAVIT (public/solicitud_avaluo_infonavit.pdf),
// en vez de una hoja membretada genérica — así el PDF descargado es
// literalmente ese formato, listo para entregar a la instancia de valuación.
//
// El formato es un solo PDF de una página sin campos de formulario (es una
// imagen), así que la geometría de cada renglón se midió sobre la plantilla
// renderizada a 600dpi (en puntos PDF, origen abajo-izquierda): para cada fila
// de casillas se tomó la línea sobre la que se escribe (`y`), la posición de
// la PRIMERA marca vertical — el borde izquierdo de la primera casilla, no el
// borde del recuadro de la sección —, el paso real entre marcas y cuántas
// casillas trae. Casi todo el formato usa un paso de ~11.8pt, pero cada fila
// difiere unas décimas (y las de teléfono, fecha y antigüedad son más
// angostas), así que cada campo lleva su propio paso en vez de una constante.
// Cada carácter se escribe centrado en su casilla ("comb").

import { DESTINO_CREDITO_OPTIONS } from "./solicitudAvaluo";

const TEMPLATE_URL = "/solicitud_avaluo_infonavit.pdf";

const SIZE = 9;
const SIZE_SMALL = 8;

// Distancia entre la línea impresa de la casilla y la línea base del texto.
const BASELINE_RISE = 2;

const SMART_CHARS = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
};

function sanitize(text) {
  return String(text ?? "")
    .replace(/[‘’“”–—…]/g, (c) => SMART_CHARS[c])
    .replace(/[^\x20-\xFF\n]/g, "");
}

// Círculos de "Destino del crédito" (centro de cada círculo, medido sobre la
// plantilla). El índice coincide con DESTINO_CREDITO_OPTIONS.
const DESTINO_CIRCLES = [
  { x: 224.5, y: 701 },
  { x: 302.8, y: 701 },
  { x: 437.9, y: 701 },
  { x: 547.4, y: 701 },
];

// Campos "comb": un carácter por casilla.
//   x          borde izquierdo de la primera casilla (primera marca impresa)
//   y          línea impresa sobre la que se escribe
//   cellWidth  paso real entre marcas de esa fila
//   maxCells   casillas impresas (lo que sobre se recorta)
//   size       tamaño de letra (por defecto SIZE)
//   rise       separación línea→línea base (por defecto BASELINE_RISE)
//   rows       otras líneas `y` donde continúa el texto cuando no cabe en la primera
const COMB_FIELDS = {
  nss: { x: 240.1, y: 659.07, cellWidth: 11.817, maxCells: 11, size: SIZE_SMALL },

  // Sección 1 — derechohabiente
  dh_apellido_paterno: { x: 57.74, y: 643.17, cellWidth: 11.836, maxCells: 40 },
  dh_apellido_materno: { x: 57.74, y: 627.27, cellWidth: 11.836, maxCells: 40 },
  dh_nombres: { x: 57.74, y: 611.43, cellWidth: 11.836, maxCells: 40 },
  // Este renglón trae el encabezado "DOMICILIO ACTUAL" pegado arriba (en vez
  // de una etiqueta abajo), así que usa letra chica y se escribe más abajo
  // dentro de su fila para no pisarlo.
  dh_calle_numero: { x: 57.98, y: 587.19, cellWidth: 11.797, maxCells: 41, size: SIZE_SMALL, rise: 1 },
  dh_colonia: { x: 57.88, y: 571.23, cellWidth: 11.817, maxCells: 20 },
  dh_municipio: { x: 304.22, y: 571.23, cellWidth: 11.819, maxCells: 19 },
  dh_estado: { x: 57.8, y: 553.53, cellWidth: 11.92, maxCells: 15 },
  dh_codigo_postal: { x: 239.64, y: 553.53, cellWidth: 11.789, maxCells: 5 },

  // Teléfonos: lada de 3 casillas "( )" y número de 8 casillas.
  dh_telefono_casa_lada: { x: 363.4, y: 553.53, cellWidth: 11.77, maxCells: 3 },
  dh_telefono_casa_numero: { x: 403.44, y: 553.53, cellWidth: 11.806, maxCells: 8 },
  dh_telefono_trabajo_lada: { x: 363.3, y: 540.93, cellWidth: 11.8, maxCells: 3 },
  dh_telefono_trabajo_numero: { x: 403.42, y: 540.93, cellWidth: 11.805, maxCells: 8 },
  dh_telefono_celular_lada: { x: 362.9, y: 529.23, cellWidth: 11.8, maxCells: 3 },
  dh_telefono_celular_numero: { x: 403.09, y: 529.23, cellWidth: 11.797, maxCells: 8 },

  // Sección 2 — propietario actual
  prop_apellido_paterno: { x: 57.86, y: 476.97, cellWidth: 11.829, maxCells: 19 },
  prop_apellido_materno: { x: 57.89, y: 461.07, cellWidth: 11.816, maxCells: 19 },
  prop_nombre_razon_social: { x: 57.87, y: 445.23, cellWidth: 11.823, maxCells: 19 },
  prop_rfc: { x: 73.67, y: 428.85, cellWidth: 11.803, maxCells: 13 },
  // El acreedor trae dos renglones de 19 casillas.
  prop_acreedor_hipotecario: { x: 57.89, y: 406.47, cellWidth: 11.817, maxCells: 19, rows: [396.15] },
  prop_rfc_acreedor: { x: 73.68, y: 385.47, cellWidth: 11.802, maxCells: 13 },
  prop_calle_numero: { x: 306.06, y: 468.99, cellWidth: 11.816, maxCells: 20 },
  prop_colonia: { x: 306.06, y: 453.15, cellWidth: 11.816, maxCells: 20 },
  prop_municipio: { x: 306.02, y: 437.25, cellWidth: 11.822, maxCells: 20 },
  prop_estado: { x: 306, y: 421.35, cellWidth: 11.88, maxCells: 15 },
  prop_codigo_postal: { x: 487.53, y: 421.35, cellWidth: 11.818, maxCells: 5 },

  prop_telefono_trabajo_lada: { x: 362.3, y: 400.83, cellWidth: 11.8, maxCells: 3 },
  prop_telefono_trabajo_numero: { x: 402.42, y: 400.83, cellWidth: 11.806, maxCells: 8 },
  prop_telefono_celular_lada: { x: 362.3, y: 389.19, cellWidth: 11.8, maxCells: 3 },
  prop_telefono_celular_numero: { x: 402.41, y: 389.19, cellWidth: 11.806, maxCells: 8 },

  // Sección 3 — vivienda
  viv_clave_conjunto: { x: 203.51, y: 341.07, cellWidth: 11.828, maxCells: 16 },
  // Pegada a la línea que cierra el recuadro de arriba, de ahí la letra chica.
  viv_calle: { x: 56.81, y: 318.63, cellWidth: 11.839, maxCells: 40, size: SIZE_SMALL },
  viv_numero_exterior: { x: 56.93, y: 302.31, cellWidth: 11.808, maxCells: 3 },
  viv_numero_interior: { x: 99.94, y: 302.31, cellWidth: 11.802, maxCells: 3 },
  viv_lote: { x: 141.88, y: 302.31, cellWidth: 11.78, maxCells: 3 },
  viv_manzana: { x: 183.64, y: 302.31, cellWidth: 11.826, maxCells: 3 },
  viv_colonia: { x: 237.6, y: 302.31, cellWidth: 11.836, maxCells: 20 },
  viv_municipio: { x: 56.86, y: 286.47, cellWidth: 11.843, maxCells: 17 },
  viv_estado: { x: 289.43, y: 286.47, cellWidth: 11.834, maxCells: 16 },
  viv_codigo_postal: { x: 489.55, y: 286.47, cellWidth: 11.823, maxCells: 5 },
  viv_antiguedad: { x: 86.02, y: 270.57, cellWidth: 11.82, maxCells: 2, size: SIZE_SMALL },

  // Sección 4 — "Ciudad de ___ a __ de ______ de 20__"
  ciudad_solicitud: { x: 92.9, y: 161.79, cellWidth: 11.84, maxCells: 19 },
  fecha_dia: { x: 326.8, y: 161.79, cellWidth: 9.95, maxCells: 2, size: SIZE_SMALL },
  fecha_anio: { x: 502.02, y: 161.79, cellWidth: 10.35, maxCells: 2, size: SIZE_SMALL },
};

// El mes se escribe completo (no por casilla), centrado en su recuadro.
const FECHA_MES = { centerX: 419.5, y: 161.79, size: SIZE_SMALL };

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Separa un teléfono de 10 dígitos en lada (3) + número (7), como lo pide el
// formato. Si trae menos de 10 dígitos se reparte lo que haya sin tronar.
function splitTelefono(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length <= 3) return { lada: digits, numero: "" };
  return { lada: digits.slice(0, 3), numero: digits.slice(3, 10) };
}

export async function buildSolicitudAvaluoOfficialPdf(record) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const templateBytes = await fetch(TEMPLATE_URL).then((res) => {
    if (!res.ok) throw new Error("No se pudo cargar el formato oficial de INFONAVIT");
    return res.arrayBuffer();
  });

  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);

  const drawCenteredText = (text, { centerX, y, size = SIZE }) => {
    const value = sanitize(text);
    if (!value) return;
    const w = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: centerX - w / 2, y: y + BASELINE_RISE, size, font, color: black });
  };

  const drawComb = (text, { x, y, cellWidth, maxCells, size = SIZE, rise = BASELINE_RISE, rows = [] }) => {
    const chars = sanitize(text).split("");
    [y, ...rows].forEach((lineY, row) => {
      chars.slice(row * maxCells, (row + 1) * maxCells).forEach((ch, i) => {
        const cellCenter = x + i * cellWidth + cellWidth / 2;
        const w = font.widthOfTextAtSize(ch, size);
        page.drawText(ch, { x: cellCenter - w / 2, y: lineY + rise, size, font, color: black });
      });
    });
  };

  const TELEFONO_PREFIXES = ["dh_telefono_casa", "dh_telefono_trabajo", "dh_telefono_celular", "prop_telefono_trabajo", "prop_telefono_celular"];
  const isTelefonoPart = (key) => TELEFONO_PREFIXES.some((prefix) => key === `${prefix}_lada` || key === `${prefix}_numero`);

  for (const [key, pos] of Object.entries(COMB_FIELDS)) {
    if (isTelefonoPart(key)) continue; // se procesan abajo, en pareja
    drawComb(record[key], pos);
  }

  for (const prefix of TELEFONO_PREFIXES) {
    const { lada, numero } = splitTelefono(record[prefix]);
    drawComb(lada, COMB_FIELDS[`${prefix}_lada`]);
    drawComb(numero, COMB_FIELDS[`${prefix}_numero`]);
  }

  const destinoIndex = DESTINO_CREDITO_OPTIONS.indexOf(record.destino_credito);
  if (destinoIndex !== -1) {
    const { x, y } = DESTINO_CIRCLES[destinoIndex];
    page.drawCircle({ x, y, size: 3.2, color: black });
  }

  if (record.fecha_solicitud) {
    const [year, month, day] = String(record.fecha_solicitud).slice(0, 10).split("-");
    if (day) drawComb(day, COMB_FIELDS.fecha_dia);
    if (month) drawCenteredText(MESES[Number(month) - 1] || "", FECHA_MES);
    if (year) drawComb(year.slice(-2), COMB_FIELDS.fecha_anio);
  }

  return doc.save();
}

function fileSafe(text) {
  return sanitize(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function downloadSolicitudAvaluoOfficialPdf(record, nombre) {
  const bytes = await buildSolicitudAvaluoOfficialPdf(record);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `Solicitud_Avaluo_${fileSafe(nombre) || "Sin_nombre"}_${stamp}.pdf`.slice(0, 150);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
