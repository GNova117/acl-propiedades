// Definición de campos y validación del perfilamiento del vendedor.
// Una sola fuente de verdad: la usan el formulario, la vista de lectura y el PDF,
// para que las tres no se desincronicen cuando se agregue o cambie un campo.

export const ESTADOS_CIVILES = ["Soltero", "Casado", "Divorciado", "Viudo", "Unión libre"];

export const TIPOS_INMUEBLE = ["Casa habitación", "Departamento", "Terreno", "Local comercial", "Bodega", "Otro"];

export const FORMAS_ADQUISICION = [
  "Infonavit",
  "Fovissste",
  "Crédito bancario",
  "Compraventa",
  "Herencia",
  "Donación",
  "Otro",
];

export const GRAVAMENES = ["Libre de gravamen", "Con gravamen"];

// Los valores de RFC/CURP se guardan siempre en mayúsculas.
export const UPPERCASE_FIELDS = ["rfc", "curp"];

export const RFC_REGEX = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;
export const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;
export const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const TELEFONO_REGEX = /^[0-9]{10}$/;

export const VENDEDOR_FIELDS = [
  { key: "nombre_completo", label: "Nombre completo del vendedor", type: "text", required: true },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date", required: true },
  { key: "estado_civil", label: "Estado civil", type: "select", options: ESTADOS_CIVILES },
  { key: "domicilio", label: "Domicilio", type: "textarea", required: true, full: true },
  { key: "correo", label: "Correo electrónico", type: "email" },
  { key: "telefono", label: "Teléfono", type: "tel" },
  { key: "rfc", label: "RFC", type: "text" },
  { key: "curp", label: "CURP", type: "text" },
  { key: "identificacion_oficial", label: "Número de identificación oficial", type: "text" },
];

export const INMUEBLE_FIELDS = [
  { key: "ubicacion", label: "Ubicación del inmueble", type: "textarea", required: true, full: true },
  { key: "tipo_inmueble", label: "Tipo de inmueble", type: "select", options: TIPOS_INMUEBLE },
  { key: "caracteristicas", label: "Características", type: "textarea", full: true },
  { key: "superficie_terreno", label: "Superficie de terreno (m²)", type: "number" },
  { key: "superficie_construccion", label: "Superficie de construcción (m²)", type: "number" },
  { key: "uso_suelo", label: "Uso de suelo", type: "text" },
  { key: "antiguedad", label: "Antigüedad (años)", type: "integer" },
  { key: "forma_adquisicion", label: "Forma de adquisición", type: "select", options: FORMAS_ADQUISICION },
  { key: "gravamenes", label: "Gravámenes de propiedad", type: "select", options: GRAVAMENES },
  // Solo se muestra (y se guarda) cuando gravamenes === "Con gravamen".
  { key: "gravamenes_detalle", label: "Detalle del gravamen", type: "textarea", full: true, dependsOn: { field: "gravamenes", value: "Con gravamen" } },
  { key: "registro_partida", label: "Partida", type: "text" },
  { key: "registro_libro", label: "Libro", type: "text" },
  { key: "registro_seccion", label: "Sección", type: "text" },
  { key: "registro_fecha_inscripcion", label: "Fecha de inscripción", type: "date" },
];

export const ALL_FIELDS = [...VENDEDOR_FIELDS, ...INMUEBLE_FIELDS];

export const EMPTY_PERFILAMIENTO = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, ""]));

export function isFieldVisible(field, form) {
  if (!field.dependsOn) return true;
  return form[field.dependsOn.field] === field.dependsOn.value;
}

// Validación compartida. Devuelve { campo: "mensaje" } — vacío si todo está bien.
export function validatePerfilamiento(form) {
  const errors = {};

  for (const field of ALL_FIELDS) {
    if (!isFieldVisible(field, form)) continue;
    const value = (form[field.key] ?? "").toString().trim();
    if (field.required && !value) {
      errors[field.key] = "Este campo es obligatorio";
    }
  }

  const correo = (form.correo ?? "").trim();
  if (correo && !EMAIL_REGEX.test(correo)) {
    errors.correo = "Correo electrónico no válido";
  }

  const telefono = (form.telefono ?? "").trim();
  if (telefono && !TELEFONO_REGEX.test(telefono)) {
    errors.telefono = "El teléfono debe tener exactamente 10 dígitos";
  }

  const rfc = (form.rfc ?? "").trim().toUpperCase();
  if (rfc && !RFC_REGEX.test(rfc)) {
    errors.rfc = "RFC no válido (13 caracteres, persona física)";
  }

  const curp = (form.curp ?? "").trim().toUpperCase();
  if (curp && !CURP_REGEX.test(curp)) {
    errors.curp = "CURP no válida (18 caracteres)";
  }

  if (form.gravamenes === "Con gravamen" && !(form.gravamenes_detalle ?? "").trim()) {
    errors.gravamenes_detalle = "Describe el gravamen";
  }

  for (const key of ["superficie_terreno", "superficie_construccion", "antiguedad"]) {
    const raw = (form[key] ?? "").toString().trim();
    if (raw && (Number.isNaN(Number(raw)) || Number(raw) < 0)) {
      errors[key] = "Debe ser un número válido";
    }
  }

  return errors;
}

const NUMERIC_FIELDS = ["superficie_terreno", "superficie_construccion"];
const INTEGER_FIELDS = ["antiguedad"];

// Normaliza el formulario al shape que espera la base de datos: recorta
// espacios, pasa RFC/CURP a mayúsculas, convierte números y manda a null los
// campos vacíos (incluido el detalle de gravamen si ya no aplica).
export function toPerfilamientoPayload(form) {
  const payload = {};

  for (const field of ALL_FIELDS) {
    let value = form[field.key];
    if (typeof value === "string") value = value.trim();
    if (UPPERCASE_FIELDS.includes(field.key) && value) value = value.toUpperCase();
    if (!isFieldVisible(field, form)) value = "";

    if (value === "" || value == null) {
      payload[field.key] = null;
    } else if (NUMERIC_FIELDS.includes(field.key)) {
      payload[field.key] = Number(value);
    } else if (INTEGER_FIELDS.includes(field.key)) {
      payload[field.key] = parseInt(value, 10);
    } else {
      payload[field.key] = value;
    }
  }

  return payload;
}

// Campos que la lista NO necesita: RFC, CURP e identificación oficial son
// datos sensibles y solo viajan cuando se abre un perfilamiento concreto.
export const PERFILAMIENTO_LIST_FIELDS = [
  "id",
  "cliente_id",
  "nombre_completo",
  "ubicacion",
  "tipo_inmueble",
  "fecha_creacion",
  "fecha_modificacion",
];

// dd/mm/aaaa a partir de un valor de <input type="date"> (aaaa-mm-dd).
export function formatFecha(value) {
  if (!value) return "";
  const [year, month, day] = value.toString().slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

// Valor listo para mostrar/imprimir, con unidades donde aplica.
export function displayValue(field, form) {
  const raw = form[field.key];
  if (raw === "" || raw == null) return "";
  if (field.type === "date") return formatFecha(raw);
  if (field.key === "superficie_terreno" || field.key === "superficie_construccion") return `${raw} m²`;
  if (field.key === "antiguedad") return `${raw} años`;
  return raw.toString();
}
