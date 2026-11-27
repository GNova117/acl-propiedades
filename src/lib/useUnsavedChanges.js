import { useEffect, useRef } from "react";

// Avisa al cerrar la pestaña o recargar con un formulario a medias («¿Salir? Se perderán los cambios»).
// `value`: lo que el formulario tiene hoy; `ready`: ya cargó (en una edición, ya llegó el registro); `enabled`: apágalo mientras guarda.
// La referencia es lo que había la primera vez que estuvo listo; si `value` cambia respecto a eso, hay cambios sin guardar.
export function isDirty(baseline, value) {
  return baseline !== undefined && JSON.stringify(value) !== baseline;
}

export function useUnsavedChanges(value, { ready = true, enabled = true } = {}) {
  const baseline = useRef(undefined);
  if (ready && baseline.current === undefined) baseline.current = JSON.stringify(value);
  const dirty = enabled && ready && isDirty(baseline.current, value);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return dirty;
}
