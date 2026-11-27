// Mensaje precargado del formulario de Contacto (?mensaje=…): lo usan «Reportar un error en esta publicación» y
// cualquier enlace que quiera dejar el texto empezado. Se recorta y se limpia de caracteres de control.
export const MAX_PREFILL = 500;

export function prefillMessage(search) {
  const raw = new URLSearchParams(search || "").get("mensaje") || "";
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, MAX_PREFILL);
}

export function contactPathWithMessage(message) {
  const text = String(message || "").trim().slice(0, MAX_PREFILL);
  return text ? `/contacto?mensaje=${encodeURIComponent(text)}` : "/contacto";
}
