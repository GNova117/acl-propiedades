// Foco del teclado en las ventanas emergentes (role="dialog"/"alertdialog" con aria-modal="true"): al abrirse el foco entra
// en ella, Tab y Shift+Tab se quedan DENTRO (no se van a la página de atrás) y al cerrarse el foco vuelve al botón que la
// abrió. Se instala UNA vez para todo el sitio (main.jsx) vigilando el documento, así cubre las ventanas que ya existen y
// las que se agreguen sin tocar cada una. Una ventana que ya maneja su foco (data-manages-focus) se deja en paz.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const DIALOG = '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

// ¿Se le puede devolver el foco? No si está dentro de un <details> cerrado (el contenido no se dibuja y el foco no entra).
const canFocus = (el) => el.isConnected && isVisible(el) && !(el.closest("details:not([open])") && !el.closest("summary"));

export const focusablesIn = (root) => [...root.querySelectorAll(FOCUSABLE)].filter((el) => isVisible(el));

// `tracked`: ventanas abiertas, en orden de apertura (la última es la de arriba).
export function installDialogFocus(doc = document) {
  const tracked = [];
  // El último elemento que tuvo el foco: si el botón que abre la ventana se oculta justo al pulsarlo (un «Más» que se cierra),
  // el navegador ya le quitó el foco cuando la ventana aparece y document.activeElement es <body>.
  let lastFocused = null;
  const onFocusIn = (e) => {
    lastFocused = e.target;
  };
  doc.addEventListener("focusin", onFocusIn);

  const top = () => {
    for (let i = tracked.length - 1; i >= 0; i -= 1) if (tracked[i].el.isConnected) return tracked[i];
    return null;
  };

  const open = (el) => {
    if (el.hasAttribute("data-manages-focus") || tracked.some((t) => t.el === el)) return;
    const entry = { el, opener: doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : lastFocused };
    tracked.push(entry);
    if (!el.contains(doc.activeElement)) {
      const target = el.querySelector("[autofocus]") || focusablesIn(el)[0];
      if (target) target.focus();
      else {
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
        el.focus();
      }
    }
  };

  const close = (entry) => {
    tracked.splice(tracked.indexOf(entry), 1);
    // El foco vuelve a donde estaba, salvo que la persona ya lo haya movido a otra cosa (o la ventana abrió una página nueva).
    const lost = !doc.activeElement || doc.activeElement === doc.body || entry.el.contains(doc.activeElement);
    if (!lost) return;
    let target = entry.opener;
    // Si el botón que la abrió ya no se ve (p. ej. estaba en un «Más» que se cierra al elegir), el foco va al «Más».
    if (target && !canFocus(target)) target = target.closest?.("details")?.querySelector(":scope > summary") ?? null;
    if (target?.isConnected && typeof target.focus === "function") target.focus();
  };

  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches?.(DIALOG)) open(root);
    root.querySelectorAll?.(DIALOG).forEach(open);
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach(scan);
    // Las que ya no están en el documento se cierran (en el orden inverso: primero la de arriba).
    for (const entry of [...tracked].reverse()) if (!entry.el.isConnected) close(entry);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.querySelectorAll(DIALOG).forEach(open);

  const onKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const current = top();
    if (!current) return;
    const items = focusablesIn(current.el);
    if (items.length === 0) {
      e.preventDefault();
      current.el.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = doc.activeElement;
    if (!current.el.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (active === first || active === current.el)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  doc.addEventListener("keydown", onKeyDown);

  return () => {
    observer.disconnect();
    doc.removeEventListener("keydown", onKeyDown);
    doc.removeEventListener("focusin", onFocusIn);
  };
}
