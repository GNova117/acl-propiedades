// Semáforo del expediente de un cliente en la lista: qué datos obligatorios le faltan (los mismos que exige el formulario).
import * as fields from "./clientExpedienteFields";

const BASIC_LABELS = { name: "Nombre", phone: "Teléfono", email: "Correo" };

// llave → etiqueta legible (los datos básicos y todos los campos del expediente).
function labelFor(key) {
  if (BASIC_LABELS[key]) return BASIC_LABELS[key];
  for (const value of Object.values(fields)) {
    if (Array.isArray(value)) {
      const found = value.find((f) => f && typeof f === "object" && f.key === key);
      if (found) return found.label;
    }
  }
  return key;
}

const isEmpty = (value) => value == null || String(value).trim() === "";

// → { level: "ok" | "mid" | "low", missing: [{ key, label }], filled, total }
export function expedienteStatus(client) {
  const required = fields.requiredClientKeys(client || {});
  const missing = required.filter((key) => isEmpty(client?.[key])).map((key) => ({ key, label: labelFor(key) }));
  const total = required.length;
  const filled = total - missing.length;
  const level = missing.length === 0 ? "ok" : missing.length <= 2 ? "mid" : "low";
  return { level, missing, filled, total };
}
