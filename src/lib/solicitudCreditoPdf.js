// Llena la "Solicitud de Inscripción de Crédito" (formato INFONAVIT
// CRED.1000.25) usando sus propios campos de formulario (AcroForm) — a
// diferencia de la Solicitud de avalúo (que es una imagen y se llena
// dibujando texto encima en coordenadas fijas), este PDF SÍ trae campos de
// formulario reales, así que se llena por nombre de campo con la API de
// formularios de pdf-lib.
//
// El PDF que se sube a public/ trae un ejemplo ya capturado (no está en
// blanco) — por eso el primer paso siempre es limpiar TODOS los campos
// (texto a "", radios sin seleccionar, checkboxes destildados) antes de
// escribir los datos de la solicitud; si no, los datos del ejemplo se
// colarían en cualquier campo que esta pantalla no llene.
//
// Dos campos del PDF original están repetidos con el mismo nombre interno
// ("P", el código postal de cada una de las 2 referencias familiares):
// pdf-lib solo expone el primero por `form.getTextField(name)`, así que se
// acceden por posición dentro de `form.getFields()`.
//
// Los campos del PDF original son rectángulos de ~12pt de alto, con letra de
// 10–12pt y sin casillas: el texto salía pegado a los renglones, encima de las
// etiquetas y sin caer en las casillas impresas. Por eso, al escribir cada
// campo se recoloca y se le da formato según la geometría medida de su renglón
// de casillas (solicitudCreditoLayout.js): cada carácter en su casilla, sobre
// la línea impresa. Si el valor no cabe en las casillas (p. ej. un monto de 7
// dígitos en 6 casillas) o es una lada (el formato solo trae 2 casillas), se
// escribe como texto corrido en vez de truncarlo.

import { CELL_ROWS } from "./solicitudCreditoLayout";
import {
  PRODUCTO_OPTIONS,
  TIPO_CREDITO_OPTIONS,
  TIPO_CREDITO_CORRESIDENCIAL_OPTIONS,
  FAMILIAR_OPTIONS,
  DESTINO_CREDITO_CREDITO_OPTIONS,
  SI_NO_OPTIONS,
  TIPO_DISCAPACIDAD_OPTIONS,
  PERSONA_DISCAPACIDAD_OPTIONS,
  GENERO_OPTIONS,
  ESTADO_CIVIL_CREDITO_OPTIONS,
  REGIMEN_PATRIMONIAL_OPTIONS,
  VENDEDOR_TIPO_OPTIONS,
  CONTACTO_TIPO_OPTIONS,
  OFERTA_VINCULANTE_CREDITO_OPTIONS,
} from "./solicitudCredito";

const TEMPLATE_URL = "/solicitud_credito_infonavit.pdf";

// Campos de texto simples: clave interna -> nombre exacto del campo en el PDF.
export const TEXT_FIELD_MAP = {
  entidad_financiera: "ENTIDAD FINANCIERA",
  desc_pension_dh: "Desc. Pension DH",
  desc_pension_cfc: "Desc. Pension CFC",
  monto_credito_dh: "Monto Credito DH",
  monto_credito_cfc: "Monto Crédito CFC",
  monto_ahorro: "Monto Ahorro",
  viv_calle: "Calle DV",
  viv_num_ext: "N° Ext DV",
  viv_num_int: "N° Int DV",
  viv_lote: "Lote DV",
  viv_mza: "Mza",
  viv_colonia: "Colonia DV",
  viv_entidad: "Entidad DV",
  viv_municipio: "Municipio / Delegación",
  viv_cp: "Codigo Postal DV",
  precio_compraventa: "Precio CV",
  monto_presupuesto_construccion: "Presupuesto",
  monto_presupuesto_reparar: "Presupuesto R",
  monto_deuda: "Pasivos",
  empresa_nombre: "Nombre Empresa",
  empresa_nrp: "NRP",
  empresa_lada: "Lada Empresa",
  empresa_numero: "Número Empresa",
  empresa_ext: "Ext Empresa",
  nss: "NSS",
  curp: "CURP",
  rfc: "RFC",
  apellido_paterno: "A. Paterno",
  apellido_materno: "A. Materno",
  nombres: "Nombre",
  domicilio_calle: "Calle y N° DI-DH",
  domicilio_colonia: "Colonia DI-DH",
  domicilio_entidad: "Entidad DI-DH",
  domicilio_delegacion: "Delegación DI-DH",
  domicilio_cp: "P DI-DH",
  telefono_lada: "Lada DI-DH",
  telefono_numero: "Número DI-DH",
  celular: "Celular DI-DH",
  email: "e-mail DI-DH",
  cfc_nss: "NSS  CFC",
  cfc_curp: "CURP CFC",
  cfc_rfc: "RFC CFC",
  cfc_apellido_paterno: "A. PATERNO CFC",
  cfc_apellido_materno: "A. MATRNO CFC",
  cfc_nombre: "NOMBRE CFC",
  cfc_lada: "Lada CFC",
  cfc_numero: "Número CFC",
  cfc_celular: "Celular CFC",
  cfc_email: "e-mail cfc",
  cfc_empresa_nombre: "Empresa CFC",
  cfc_empresa_nrp: "NRP CFC",
  ref1_paterno: "RF1 Paterno",
  ref1_materno: "RF1 Materno",
  ref1_nombre: "RF1 Nombre",
  ref1_lada: "RF Lada1",
  ref1_numero: "RF1 Numero",
  ref1_celular: "RF1 Celular",
  ref1_calle: "RF1 Calle y Número",
  ref1_colonia: "RF1 Colonia",
  ref1_entidad: "RF1 Entidad",
  ref1_delegacion: "RF1  Delegación",
  ref2_paterno: "RF2  Paterno",
  ref2_materno: "RF2 Materno",
  ref2_nombre: "RF2 Nombre",
  ref2_lada: "RF2 Lada",
  ref2_numero: "RF2 Número",
  ref2_celular: "RF2 Celular",
  ref2_calle: "RF2 Calle",
  ref2_colonia: "RF2 Colonia",
  ref2_entidad: "RF2 Entidad",
  ref2_delegacion: "RF2 Delegación",
  vendedor_nombre: "Nombre vendedor",
  vendedor_rfc: "RFC vendedor",
  vendedor_razon_social_cuenta: "Razon Social Vendedor",
  vendedor_clabe: "Clabe Vendedor",
  acreedor_nombre: "Razon Social Vend2",
  acreedor_rfc: "RFC Vend2",
  acreedor_razon_social_cuenta: "RFC Vend 2b",
  // "Razon Social  Vend2" es un renglón de continuación de la razón social; el de la CLABE es "Texto94".
  acreedor_clabe: "Texto94",
  numero_credito_titular: "N° Credito Titular",
  numero_credito_cfc: "N° Crédito CFC",
  numero_inventario_vr: "N°  Inventario VR",
  numero_credito_entidad: "F",
  repres_paterno: "Repres. Paterno",
  repres_materno: " Materno",
  repres_nombre: "Repres. Nombre",
  repres_lada: "R Lada",
  repres_numero: " Número",
  repres_celular: " Celular",
  repres_identificacion: "N° Identificación",
  contacto_curp: "Curp PV",
  contacto_paterno: "Paterno PV",
  contacto_materno: "Materno PV",
  contacto_nombre: "Nombre PV",
  contacto_lada: "Lada PV",
  contacto_numero: "Número PV",
  ciudad: "Ciudad",
};

// Grupos de radio/checkbox: clave interna -> { pdf: nombre del campo,
// values: { etiqueta legible -> valor interno que usa el PDF } }. Las
// etiquetas son las que ve y guarda la pantalla; el valor del PDF es el que
// de verdad trae el formato oficial (se midió sobre la plantilla, no es
// descriptivo por sí solo).
export const RADIO_FIELD_MAP = {
  producto: { pdf: "Producto", values: zip(PRODUCTO_OPTIONS, ["1", "2", "3", "4"]) },
  tipo_credito: { pdf: "Tipo de Crédito", values: zip(TIPO_CREDITO_OPTIONS, ["Opción1", "2", "3", "4"]) },
  tipo_credito_corresidencial: {
    pdf: "Tipo de Crédito Corresidencial",
    values: zip(TIPO_CREDITO_CORRESIDENCIAL_OPTIONS, ["Opción5", "Opción6"]),
  },
  familiar: { pdf: "Familiar", values: zip(FAMILIAR_OPTIONS, ["Opción8", "Opción9", "Opción10"]) },
  destino_credito: {
    pdf: "Destino de Crédito",
    values: zip(DESTINO_CREDITO_CREDITO_OPTIONS, ["destino 1", "2", "3", "4", "5", "6", "7", "8"]),
  },
  equipa_tu_casa: { pdf: "ETC", values: zip(SI_NO_OPTIONS, ["Opción1", "Opción2"]) },
  discapacidad: { pdf: "HATM", values: zip(SI_NO_OPTIONS, ["Opción1", "Opción2"]) },
  tipo_discapacidad: { pdf: "Tipo Discapacidad", values: zip(TIPO_DISCAPACIDAD_OPTIONS, ["Opción3", "Opción4", "Opción5", "Opción6"]) },
  persona_discapacidad: {
    pdf: "DISCAPACITADO",
    values: zip(PERSONA_DISCAPACIDAD_OPTIONS, ["Opción7", "Opción8", "Opción9", "Opción10", "Opción11"]),
  },
  afectacion_estructural: { pdf: "Afectación Est", values: zip(SI_NO_OPTIONS, ["Afectacion Si", "Afectación No"]) },
  genero: { pdf: "Genero", values: zip(GENERO_OPTIONS, ["0", "1"]) },
  estado_civil: { pdf: "Estado Civil", values: zip(ESTADO_CIVIL_CREDITO_OPTIONS, ["Opción4", "Opción3"]) },
  cfc_genero: { pdf: "Genero CFC", values: zip(GENERO_OPTIONS, ["genero c1", "Opción2"]) },
  vendedor_tipo: { pdf: "Vendedor", values: zip(VENDEDOR_TIPO_OPTIONS, ["Opción3", "Opción1", "Opción2", "Opción4", "Opción5"]) },
  contacto_tipo: { pdf: "P.V", values: zip(CONTACTO_TIPO_OPTIONS, ["Opción6", "Opción1", "Opción2"]) },
  oferta_vinculante: { pdf: "OFERTA VINCULANTE", values: zip(OFERTA_VINCULANTE_CREDITO_OPTIONS, ["Opción3", "Opción4"]) },
};

// Régimen patrimonial no es un radio en el PDF sino 3 checkboxes sueltos —
// aquí se tratan como selección única: se tilda el elegido y se destildan
// los otros 2.
export const REGIMEN_CHECKBOX_MAP = zip(REGIMEN_PATRIMONIAL_OPTIONS, [
  "undefined.Casilla de verificación3",
  "Casilla de verificación1",
  "Casilla de verificación2",
]);

function zip(labels, values) {
  return Object.fromEntries(labels.map((label, i) => [label, values[i]]));
}

const SIZE = 9;
const SIZE_SMALL = 8;
// Alto del rectángulo de cada campo y separación línea impresa → línea base del
// texto. El renglón más justo deja 9pt libres bajo la etiqueta de arriba y la
// mayúscula de 9pt mide 6.5pt, así que sobra margen.
const ROW_HEIGHT = 12;
const BASELINE_RISE = 1.8;
// Altura de mayúscula de Helvetica (em): pdf-lib centra el texto verticalmente
// en el rectángulo del campo usando esa altura.
const CAP_HEIGHT = 0.718;

// Rectángulo del campo para que la línea base del texto quede BASELINE_RISE
// arriba de la línea impresa del renglón.
function rowRectangle(row, size) {
  return {
    x: row.x,
    y: row.y + BASELINE_RISE - (ROW_HEIGHT - CAP_HEIGHT * size) / 2,
    width: row.cells * row.pitch,
    height: ROW_HEIGHT,
  };
}

// Achica la letra lo necesario para que el texto quepa en `width` (sin pasar de `size`).
function fitFontSize(value, size, font, width) {
  const natural = font.widthOfTextAtSize(value, size);
  return natural > width ? Math.max(5, (size * width) / natural) : size;
}

// Escribe `value` en un campo de texto. `rows` son los renglones de casillas de
// sus widgets (CELL_ROWS), si el formato los trae. `TextAlignment` viene de la
// importación diferida de pdf-lib (no se importa aquí para no cargarla de entrada).
function writeTextField(field, value, rows, font, TextAlignment) {
  if (!rows?.length) {
    const [widget] = field.acroField.getWidgets();
    field.setFontSize(fitFontSize(value, SIZE, font, widget.getRectangle().width - 2));
    field.setText(value);
    return;
  }

  const [first] = rows;
  const size = first.pitch >= 11 ? SIZE : SIZE_SMALL;
  const isLada = /lada/i.test(field.getName());
  const comb = !isLada && value.length <= first.cells;

  field.acroField.getWidgets().forEach((widget, i) => widget.setRectangle(rowRectangle(rows[i] ?? first, size)));
  if (comb) {
    field.setMaxLength(first.cells);
    field.enableCombing();
    field.setFontSize(size);
  } else {
    field.setAlignment(isLada ? TextAlignment.Center : TextAlignment.Left);
    field.setFontSize(fitFontSize(value, size, font, first.cells * first.pitch - 2));
  }
  field.setText(value);
}

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

export async function buildSolicitudCreditoPdf(record) {
  const { PDFDocument, StandardFonts, TextAlignment } = await import("pdf-lib");

  const templateBytes = await fetch(TEMPLATE_URL).then((res) => {
    if (!res.ok) throw new Error("No se pudo cargar el formato oficial de INFONAVIT");
    return res.arrayBuffer();
  });

  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Renglones de casillas de cada campo, en el orden de los widgets (ver CELL_ROWS).
  const cellRows = new Map();
  const consumed = {};
  for (const field of form.getFields()) {
    const name = field.getName();
    if (!CELL_ROWS[name]) continue;
    const from = consumed[name] ?? 0;
    const count = field.acroField.getWidgets().length;
    cellRows.set(field.ref.tag, CELL_ROWS[name].slice(from, from + count));
    consumed[name] = from + count;
  }
  const writeText = (field, value) => writeTextField(field, value, cellRows.get(field.ref.tag), font, TextAlignment);

  // Limpia todo el formulario (trae un ejemplo capturado, no está en blanco).
  for (const field of form.getFields()) {
    const type = field.constructor.name;
    try {
      if (type === "PDFTextField") field.setText("");
      else if (type === "PDFRadioGroup") field.clear();
      else if (type === "PDFCheckBox") field.uncheck();
      else if (type === "PDFDropdown") field.clear();
    } catch {
      // Un campo con una definición rara (p. ej. sin widgets) no debe tronar el llenado completo.
    }
  }

  // "P" (código postal de cada referencia familiar) está duplicado con el
  // mismo nombre interno en el PDF original — se accede por posición.
  const pFields = form.getFields().filter((f) => f.getName() === "P" && f.constructor.name === "PDFTextField");
  if (pFields[0] && record.ref1_cp) writeText(pFields[0], sanitizeValue(record.ref1_cp));
  if (pFields[1] && record.ref2_cp) writeText(pFields[1], sanitizeValue(record.ref2_cp));

  for (const [key, pdfName] of Object.entries(TEXT_FIELD_MAP)) {
    const value = sanitizeValue(record[key]);
    if (!value) continue;
    try {
      writeText(form.getTextField(pdfName), value);
    } catch (err) {
      console.error(`solicitudCreditoPdf: no se pudo escribir "${pdfName}"`, err);
    }
  }

  // El párrafo de la oferta vinculante repite el nombre del solicitante.
  const nombreCompleto = [record.nombres, record.apellido_paterno, record.apellido_materno].filter(Boolean).join(" ");
  if (nombreCompleto) {
    try {
      writeText(form.getTextField("Oferta Vin"), nombreCompleto);
    } catch {
      /* campo ausente en alguna variante del PDF */
    }
  }

  if (record.fecha_solicitud) {
    const [year, month, day] = String(record.fecha_solicitud).slice(0, 10).split("-");
    try {
      if (day) writeText(form.getTextField("Dia"), day);
      if (month) writeText(form.getTextField("Mes"), MESES[Number(month) - 1] || "");
      // El formato ya imprime "de 20__": solo van los dos últimos dígitos.
      if (year) writeText(form.getTextField("Año"), year.slice(-2));
    } catch {
      /* noop */
    }
  }

  for (const [key, config] of Object.entries(RADIO_FIELD_MAP)) {
    const label = record[key];
    const pdfValue = label && config.values[label];
    if (!pdfValue) continue;
    try {
      form.getRadioGroup(config.pdf).select(pdfValue);
    } catch (err) {
      console.error(`solicitudCreditoPdf: no se pudo seleccionar "${config.pdf}" = "${pdfValue}"`, err);
    }
  }

  const regimenPdfName = REGIMEN_CHECKBOX_MAP[record.regimen_patrimonial];
  if (regimenPdfName) {
    try {
      form.getCheckBox(regimenPdfName).check();
    } catch (err) {
      console.error("solicitudCreditoPdf: no se pudo marcar el régimen patrimonial", err);
    }
  }

  return doc.save();
}

function sanitizeValue(value) {
  return value == null ? "" : String(value);
}

function fileSafe(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function downloadSolicitudCreditoPdf(record, nombre) {
  const bytes = await buildSolicitudCreditoPdf(record);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `Solicitud_Credito_${fileSafe(nombre) || "Sin_nombre"}_${stamp}.pdf`.slice(0, 150);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
