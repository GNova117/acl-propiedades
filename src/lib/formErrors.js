// 261: errores de formulario accesibles. Cada campo con error apunta a su mensaje (aria-describedby) y, al intentar enviar con
// errores, el foco va al primer campo con error para que un lector de pantalla (o el teclado) lo encuentre de inmediato.
export const errorId = (fieldId) => `${fieldId}-error`;

// → props para el campo: aria-invalid y aria-describedby (solo cuando hay error)
export function fieldErrorProps(fieldId, error) {
  return error ? { "aria-invalid": true, "aria-describedby": errorId(fieldId) } : {};
}

// Mueve el foco al primer campo (en el orden de `order`) que tenga error. → true si pudo.
export function focusFirstError(errors, order, fieldIds, doc = typeof document !== "undefined" ? document : null) {
  const key = order.find((k) => errors?.[k]);
  if (!key || !doc) return false;
  const element = doc.getElementById(fieldIds[key]);
  if (!element || typeof element.focus !== "function") return false;
  element.focus();
  return true;
}
