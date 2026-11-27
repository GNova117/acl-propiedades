import { useCallback, useEffect, useRef } from "react";

// 290: un menú hecho con <details> no se cierra solo. Este hook lo cierra al tocar/clicar fuera, con Escape (devolviendo el foco
// al botón que lo abre) y a pedido (`close()`, p. ej. después de elegir una opción).
export function useDismissDetails() {
  const ref = useRef(null);

  const close = useCallback(() => {
    if (ref.current) ref.current.open = false;
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      const el = ref.current;
      if (el?.open && !el.contains(event.target)) el.open = false;
    };
    const onKeyDown = (event) => {
      const el = ref.current;
      if (event.key === "Escape" && el?.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return { ref, close };
}
