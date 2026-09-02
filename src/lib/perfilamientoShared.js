// Motor genérico de perfilamiento: lo comparten el de vendedor y el de
// comprador (y cualquier tipo nuevo que se agregue después). Cada tipo solo
// define sus secciones/campos; la validación, el armado del payload y el
// formato de lectura viven una sola vez aquí.

export const ESTADOS_CIVILES = ["Soltero", "Casado", "Divorciado", "Viudo", "Unión libre"];

export const RFC_REGEX = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;
export const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;
export const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const TELEFONO_REGEX = /^[0-9]{10}$/;
export const NSS_REGEX = /^[0-9]{11}$/;

// dd/mm/aaaa a partir de un valor de <input type="date"> (aaaa-mm-dd).
export function formatFecha(value) {
  if (!value) return "";
  const [year, month, day] = value.toString().slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function isFieldVisible(field, form) {
  if (!field.dependsOn) return true;
  return form[field.dependsOn.field] === field.dependsOn.value;
}

export function allFields(sections) {
  return sections.flatMap((section) => section.fields);
}

export function emptyForm(sections) {
  return Object.fromEntries(allFields(sections).map((f) => [f.key, ""]));
}

// Valor listo para mostrar/imprimir, con unidades donde aplica (m², años).
export function displayValue(field, form) {
  const raw = form[field.key];
  if (raw === "" || raw == null) return "";
  if (field.type === "date") return formatFecha(raw);
  if (field.unit) return `${raw} ${field.unit}`;
  return raw.toString();
}

// Validación genérica: requeridos + formatos conocidos por `type`/`format`.
// `extraRules(form)` deja que cada tipo agregue sus propias reglas cruzadas
// (p. ej. "si hay gravamen, el detalle es obligatorio").
export function validateSections(sections, form, extraRules) {
  const errors = {};

  for (const field of allFields(sections)) {
    if (!isFieldVisible(field, form)) continue;
    const value = (form[field.key] ?? "").toString().trim();

    if (field.required && !value) {
      errors[field.key] = "Este campo es obligatorio";
      continue;
    }
    if (!value) continue;

    if (field.format === "email" && !EMAIL_REGEX.test(value)) {
      errors[field.key] = "Correo electrónico no válido";
    } else if (field.format === "telefono" && !TELEFONO_REGEX.test(value)) {
      errors[field.key] = "El teléfono debe tener exactamente 10 dígitos";
    } else if (field.format === "rfc" && !RFC_REGEX.test(value.toUpperCase())) {
      errors[field.key] = "RFC no válido (13 caracteres, persona física)";
    } else if (field.format === "curp" && !CURP_REGEX.test(value.toUpperCase())) {
      errors[field.key] = "CURP no válida (18 caracteres)";
    } else if (field.format === "nss" && !NSS_REGEX.test(value)) {
      errors[field.key] = "El NSS debe tener 11 dígitos";
    } else if ((field.type === "number" || field.type === "integer") && (Number.isNaN(Number(value)) || Number(value) < 0)) {
      errors[field.key] = "Debe ser un número válido";
    }
  }

  Object.assign(errors, extraRules ? extraRules(form) : {});
  return errors;
}

// Normaliza el formulario al shape que espera la base de datos: recorta
// espacios, pasa a mayúsculas los campos marcados `uppercase`, convierte
// números, vacía los campos ocultos por `dependsOn`, y manda a null lo vacío.
export function toPayload(sections, form) {
  const payload = {};

  for (const field of allFields(sections)) {
    let value = form[field.key];
    if (typeof value === "string") value = value.trim();
    if (field.uppercase && value) value = value.toUpperCase();
    if (!isFieldVisible(field, form)) value = "";

    if (value === "" || value == null) {
      payload[field.key] = null;
    } else if (field.type === "number") {
      payload[field.key] = Number(value);
    } else if (field.type === "integer") {
      payload[field.key] = parseInt(value, 10);
    } else {
      payload[field.key] = value;
    }
  }

  return payload;
}

// El <input> es controlado: null de la base de datos debe volverse "", y las
// fechas deben quedar como aaaa-mm-dd (lo que espera <input type="date">).
export function toFormValues(record) {
  const values = {};
  for (const [key, value] of Object.entries(record)) {
    if (value == null) {
      values[key] = "";
      continue;
    }
    const text = String(value);
    values[key] = /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
  }
  return values;
}
