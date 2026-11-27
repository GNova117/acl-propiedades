// Atajos de teclado del panel: «G» y luego una letra lleva a esa pantalla («G P» = Prospectos). La búsqueda con «/» ya existía.
export const GO_TARGETS = {
  d: "/admin",
  h: "/admin/mi-dia",
  p: "/admin/prospectos",
  c: "/admin/clientes",
  a: "/admin/agenda",
  m: "/admin/mensajes",
  o: "/admin/propiedades",
};

// ¿Dónde está el foco? Con un campo de texto enfocado los atajos no se activan (se está escribiendo).
export function isTypingTarget(element) {
  if (!element) return false;
  const tag = String(element.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable === true;
}

export const SEQUENCE_WINDOW_MS = 1200;

// Estado mínimo de la secuencia: { pendingAt } → { target?, pendingAt }
export function nextShortcutState(state, key, now, { typing = false, modifier = false } = {}) {
  if (typing || modifier) return { pendingAt: 0 };
  const lower = String(key).toLowerCase();
  if (lower === "g") return { pendingAt: now };
  if (state.pendingAt && now - state.pendingAt <= SEQUENCE_WINDOW_MS && GO_TARGETS[lower]) return { target: GO_TARGETS[lower], pendingAt: 0 };
  return { pendingAt: 0 };
}
