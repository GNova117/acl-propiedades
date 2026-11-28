// Avisos discretos (toasts) y confirmaciones propias en lugar de las ventanas del navegador (alert/confirm), que
// bloquean toda la página, no se pueden estilizar ni traducir y en el teléfono se ven como un error del sistema.
//   notify(texto)                — aviso que se va solo (se pinta como error si el texto dice que algo falló)
//   toast.show / success / error — con opciones { type, duration, action: { label, onClick } }
//   confirmDialog(texto, opts)   — Promise<boolean>; opts: { confirmLabel, cancelLabel, danger }
//   undoable(texto, { onUndo })  — aviso con «Deshacer» (ver undoableDelete abajo)
// Todo es un almacén simple fuera de React (se puede llamar desde cualquier handler); <Toaster /> lo dibuja.

import i18n from "../i18n";

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 8000;
const UNDO_DURATION = 7000;

let nextId = 1;
let toasts = [];
let confirmRequest = null; // { id, message, opts, resolve } — una a la vez
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getToasts = () => toasts;
export const getConfirmRequest = () => confirmRequest;

// ¿El texto cuenta que algo falló? (los mensajes del sitio y los errores de la base vienen en español o en inglés)
const FAILURE = /\berror|no se pudo|no pudo|fall[óo]|falla|inv[aá]lid|could not|couldn't|failed|failure|unable|denied|no tienes acceso/i;
export const looksLikeFailure = (message) => FAILURE.test(String(message ?? ""));

function add(message, { type = "info", duration, action } = {}) {
  const text = String(message ?? "").trim();
  if (!text) return null;
  const id = nextId++;
  const entry = { id, message: text, type, action: action || null, duration: duration ?? (type === "error" ? ERROR_DURATION : action ? UNDO_DURATION : DEFAULT_DURATION) };
  // Un aviso idéntico ya visible no se repite (un doble clic no apila dos).
  if (toasts.some((t) => t.message === entry.message && t.type === entry.type && !t.action)) return null;
  toasts = [...toasts, entry].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismiss(id) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  show: (message, opts) => add(message, opts),
  success: (message, opts) => add(message, { ...opts, type: "success" }),
  error: (message, opts) => add(message, { ...opts, type: "error" }),
  info: (message, opts) => add(message, { ...opts, type: "info" }),
};

export const notify = (message, opts) => add(message, { type: looksLikeFailure(message) ? "error" : "info", ...opts });

// Las pruebas de navegador (e2e/fixtures.js) activan esto para aceptar solas las confirmaciones, igual que antes
// aceptaban las ventanas del navegador. Nada en producción lo activa.
const autoConfirm = () => typeof globalThis !== "undefined" && globalThis.__ACL_AUTO_CONFIRM__ === true;

export function confirmDialog(message, opts = {}) {
  if (autoConfirm()) return Promise.resolve(true);
  // Si ya hay una pendiente (otra acción la pidió a la vez), esa se cancela: solo una a la vez.
  if (confirmRequest) resolveConfirm(false);
  return new Promise((resolve) => {
    confirmRequest = { id: nextId++, message: String(message ?? ""), opts, resolve };
    emit();
  });
}

export function resolveConfirm(answer, value) {
  const request = confirmRequest;
  if (!request) return;
  confirmRequest = null;
  emit();
  // Con campo de texto (promptDialog) se devuelve lo escrito, o null si se canceló; sin campo, true/false.
  request.resolve(request.opts.input ? (answer ? String(value ?? "") : null) : Boolean(answer));
}

// Reemplaza a window.prompt (que en la app instalada del iPhone puede no mostrarse y no se puede validar ni traducir): un diálogo
// propio con un campo de texto. Devuelve lo escrito (puede ser "") o null si se cancela.
//   opts: { defaultValue, readOnly, placeholder, confirmLabel, cancelLabel, hideCancel }
export function promptDialog(message, opts = {}) {
  if (autoConfirm()) return Promise.resolve(opts.defaultValue ?? "");
  if (confirmRequest) resolveConfirm(false);
  return new Promise((resolve) => {
    confirmRequest = { id: nextId++, message: String(message ?? ""), opts: { ...opts, input: true }, resolve };
    emit();
  });
}

// Cuando el portapapeles no deja copiar (algunos navegadores y la app instalada): se muestra el texto en un campo ya seleccionado
// para copiarlo a mano. Sustituye al window.prompt(texto, valor) de siempre.
export function copyFallback(message, text) {
  return promptDialog(message, { defaultValue: text, readOnly: true, hideCancel: true, confirmLabel: i18n.t("common.close") });
}

// ── Eliminar con «Deshacer» ───────────────────────────────────────────────────────────────────────────────────────
// El elemento ya salió de la pantalla (quien llama lo quitó de su lista); el borrado real se hace pasados unos
// segundos. Con «Deshacer» no se borra y quien llama lo vuelve a poner. Si la persona se va de la página (o cierra la
// pestaña) antes, el borrado pendiente se hace de inmediato, para que no se quede a medias.
const pending = new Map();

export function undoableDelete(message, { commit, onUndo, onError, undoLabel = "Deshacer", duration = UNDO_DURATION } = {}) {
  const key = nextId++;
  let toastId = null;
  const run = async () => {
    if (!pending.delete(key)) return;
    dismiss(toastId);
    try {
      await commit();
    } catch (err) {
      onError?.(err);
    }
  };
  const timer = setTimeout(run, duration);
  pending.set(key, { run, timer });
  toastId = add(message, {
    type: "info",
    duration: duration + 500, // el borrado ya corre antes; el aviso se va justo después
    action: {
      label: undoLabel,
      onClick: () => {
        if (!pending.delete(key)) return;
        clearTimeout(timer);
        dismiss(toastId);
        onUndo?.();
      },
    },
  });
  return key;
}

// Borra YA todo lo que esté esperando su «Deshacer» (al salir de la página o cerrar la pestaña).
export function flushPendingDeletes() {
  for (const [, entry] of [...pending]) {
    clearTimeout(entry.timer);
    entry.run();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingDeletes);
  window.addEventListener("beforeunload", flushPendingDeletes);
}

// Solo para pruebas.
export function __resetToastsForTests() {
  toasts = [];
  confirmRequest = null;
  pending.forEach((e) => clearTimeout(e.timer));
  pending.clear();
  emit();
}
