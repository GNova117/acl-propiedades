import { useEffect } from "react";

// 254: una tabla del panel más ancha que la pantalla se desplaza de lado (overflow-x: auto), o más alta que su caja se desplaza
// hacia abajo (alto máximo); con teclado no hay cómo llegar a ella ni leerla. Los lectores de pantalla y el teclado necesitan que esa zona se pueda enfocar (tabindex=0) y
// tenga nombre (role="region" + aria-label). Se marca solo la que de verdad se desborda y se desmarca si deja de hacerlo,
// así no se agregan paradas de Tab inútiles. Una sola vez aquí en vez de editar las 43 tablas del panel.
export const SCROLLABLE_SELECTOR = ".admin-table-wrapper";
const AUTO = "data-auto-scroll";

export function syncScrollableRegions(root, label) {
  if (!root) return;
  for (const el of root.querySelectorAll(SCROLLABLE_SELECTOR)) {
    const overflows = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    if (overflows) {
      if (!el.hasAttribute("tabindex")) {
        el.setAttribute("tabindex", "0");
        el.setAttribute(AUTO, "1");
      }
      if (el.hasAttribute(AUTO)) {
        el.setAttribute("role", "region");
        if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", label);
      }
    } else if (el.hasAttribute(AUTO)) {
      el.removeAttribute("tabindex");
      el.removeAttribute("role");
      el.removeAttribute("aria-label");
      el.removeAttribute(AUTO);
    }
  }
}

// Mantiene al día las zonas de `rootRef` cuando cambia el contenido (carga de datos, filtros) o el tamaño de la ventana.
export function useScrollableRegions(rootRef, label) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => syncScrollableRegions(root, label));
    };
    run();
    const observer = typeof MutationObserver === "function" ? new MutationObserver(run) : null;
    observer?.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [rootRef, label]);
}
