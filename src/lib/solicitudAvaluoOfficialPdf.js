// Genera el PDF de la Solicitud de avalúo escribiendo los datos capturados
// directamente SOBRE el formato oficial de INFONAVIT (public/solicitud_avaluo_infonavit.pdf),
// en vez de una hoja membretada genérica — así el PDF descargado es
// literalmente ese formato, listo para entregar a la instancia de valuación.
//
// El formato es un solo PDF de una página sin campos de formulario (es una
// imagen), así que las coordenadas de cada renglón se midieron a mano sobre
// la plantilla (en puntos PDF, origen abajo-izquierda), renderizándola a
// 300dpi con una cuadrícula superpuesta y leyendo la posición real de cada
// fila de casillas impresa (no la de su etiqueta). Prácticamente todo el
// formato usa el mismo ancho de celda (~11.8pt), así que casi todos los
// campos se escriben como "comb": un carácter por celda, igual que el NSS o
// el teléfono. Solo "Ciudad de" queda pendiente de ese estilo porque su
// renglón no tiene etiqueta debajo que se pueda pisar.

import { DESTINO_CREDITO_OPTIONS } from "./solicitudAvaluo";

const TEMPLATE_URL = "/solicitud_avaluo_infonavit.pdf";

const SIZE = 9;
const SIZE_SMALL = 8;

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

// Campos de texto simple: se escriben alineados a la izquierda, empezando en
// (x, y) — y es la línea base, un par de puntos arriba del renglón impreso.
const TEXT_FIELDS = {
  // Sección 4 — ciudad de la solicitud (la fecha se maneja aparte: día / mes / año).
  // Es el único renglón sin etiqueta debajo (va en línea con "Ciudad de"),
  // así que no hay riesgo de pisar nada al dejarlo como texto corrido.
  ciudad_solicitud: { x: 90, y: 162 },
};

// Campos "comb": un carácter por celda, para imitar los recuadros impresos.
// Casi todo el formato usa este estilo de casillas, con el mismo ancho de
// celda (~11.8pt) en cualquier renglón — nombre, domicilio, teléfono, RFC,
// NSS, etc. — así que se escriben todos igual en vez de como texto corrido.
const COMB_FIELDS = {
  nss: { x: 254, y: 662, cellWidth: 11, maxCells: 11 },

  // Sección 1 — derechohabiente
  dh_apellido_paterno: { x: 52.3, y: 646, cellWidth: 11.8, maxCells: 42 },
  dh_apellido_materno: { x: 52.3, y: 630, cellWidth: 11.8, maxCells: 42 },
  dh_nombres: { x: 52.3, y: 614, cellWidth: 11.8, maxCells: 42 },
  // Este renglón trae el encabezado "DOMICILIO ACTUAL" pegado arriba (en vez
  // de una etiqueta abajo), así que usa letra chica y la línea base más baja
  // dentro de su propia fila de casillas para no pisarlo.
  dh_calle_numero: { x: 52.3, y: 586, cellWidth: 11.8, maxCells: 44, size: SIZE_SMALL },
  dh_colonia: { x: 52.3, y: 574, cellWidth: 11.8, maxCells: 21 },
  dh_municipio: { x: 300.5, y: 574, cellWidth: 11.8, maxCells: 20 },
  dh_estado: { x: 52.3, y: 558, cellWidth: 11.8, maxCells: 15 },
  dh_codigo_postal: { x: 225, y: 558, cellWidth: 11.8, maxCells: 10 },

  dh_telefono_casa_lada: { x: 363, y: 556, cellWidth: 11, maxCells: 3 },
  dh_telefono_casa_numero: { x: 400, y: 556, cellWidth: 10, maxCells: 7 },
  dh_telefono_trabajo_lada: { x: 363, y: 541, cellWidth: 11, maxCells: 3 },
  dh_telefono_trabajo_numero: { x: 400, y: 541, cellWidth: 10, maxCells: 7 },
  dh_telefono_celular_lada: { x: 363, y: 526, cellWidth: 11, maxCells: 3 },
  dh_telefono_celular_numero: { x: 400, y: 526, cellWidth: 10, maxCells: 7 },

  // Sección 2 — propietario actual
  prop_apellido_paterno: { x: 52.3, y: 478, cellWidth: 11.8, maxCells: 19 },
  prop_apellido_materno: { x: 52.3, y: 464, cellWidth: 11.8, maxCells: 19 },
  prop_nombre_razon_social: { x: 52.3, y: 448, cellWidth: 11.8, maxCells: 19 },
  prop_rfc: { x: 75, y: 430, cellWidth: 11.8, maxCells: 13, size: SIZE_SMALL },
  prop_acreedor_hipotecario: { x: 52.3, y: 405, cellWidth: 11.8, maxCells: 19 },
  prop_rfc_acreedor: { x: 75, y: 389, cellWidth: 11.8, maxCells: 13, size: SIZE_SMALL },
  prop_calle_numero: { x: 300.5, y: 472, cellWidth: 11.8, maxCells: 22 },
  prop_colonia: { x: 300.5, y: 456, cellWidth: 11.8, maxCells: 22 },
  prop_municipio: { x: 300.5, y: 440, cellWidth: 11.8, maxCells: 22 },
  prop_estado: { x: 300.5, y: 424, cellWidth: 11.8, maxCells: 14 },
  prop_codigo_postal: { x: 462, y: 424, cellWidth: 11.8, maxCells: 8 },

  prop_telefono_trabajo_lada: { x: 363, y: 400, cellWidth: 11, maxCells: 3 },
  prop_telefono_trabajo_numero: { x: 400, y: 400, cellWidth: 10, maxCells: 7 },
  prop_telefono_celular_lada: { x: 363, y: 384, cellWidth: 11, maxCells: 3 },
  prop_telefono_celular_numero: { x: 400, y: 384, cellWidth: 10, maxCells: 7 },

  // Sección 3 — vivienda
  viv_calle: { x: 52.3, y: 322, cellWidth: 11.8, maxCells: 42 },
  viv_numero_exterior: { x: 52.3, y: 305, cellWidth: 11.8, maxCells: 8, size: SIZE_SMALL },
  viv_numero_interior: { x: 146.7, y: 305, cellWidth: 11.8, maxCells: 7, size: SIZE_SMALL },
  viv_lote: { x: 229.3, y: 305, cellWidth: 11.8, maxCells: 5, size: SIZE_SMALL },
  viv_manzana: { x: 288.3, y: 305, cellWidth: 11.8, maxCells: 5, size: SIZE_SMALL },
  viv_colonia: { x: 347.3, y: 305, cellWidth: 11.8, maxCells: 17 },
  viv_municipio: { x: 52.3, y: 286, cellWidth: 11.8, maxCells: 17 },
  viv_estado: { x: 289, y: 286, cellWidth: 11.8, maxCells: 15 },
  viv_codigo_postal: { x: 466, y: 286, cellWidth: 11.8, maxCells: 8 },

  viv_clave_conjunto: { x: 200, y: 338, cellWidth: 11.9, maxCells: 16, size: SIZE_SMALL },
  viv_antiguedad: { x: 85, y: 273, cellWidth: 11.8, maxCells: 2, size: SIZE_SMALL },

  fecha_dia: { x: 327, y: 162, cellWidth: 11, maxCells: 2, size: SIZE_SMALL },
  fecha_anio: { x: 506, y: 162, cellWidth: 11, maxCells: 2, size: SIZE_SMALL },
};

const FECHA_MES_X = 403;
const FECHA_MES_Y = 162;

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

  const drawText = (text, { x, y, size = SIZE }) => {
    const value = sanitize(text);
    if (!value) return;
    page.drawText(value, { x, y, size, font, color: black });
  };

  const drawComb = (text, { x, y, cellWidth, maxCells, size = SIZE }) => {
    const chars = sanitize(text).slice(0, maxCells).split("");
    chars.forEach((ch, i) => {
      const cellCenter = x + i * cellWidth + cellWidth / 2;
      const w = font.widthOfTextAtSize(ch, size);
      page.drawText(ch, { x: cellCenter - w / 2, y, size, font, color: black });
    });
  };

  for (const [key, pos] of Object.entries(TEXT_FIELDS)) {
    drawText(record[key], pos);
  }

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
    if (month) drawText(MESES[Number(month) - 1] || "", { x: FECHA_MES_X, y: FECHA_MES_Y, size: SIZE_SMALL });
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
