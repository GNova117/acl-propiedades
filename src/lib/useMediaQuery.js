import { useEffect, useState } from "react";

// true mientras la pantalla cumple la consulta de CSS (p. ej. "(min-width: 981px)");
// se actualiza solo si cambia (girar la tableta, cambiar el tamaño de la ventana).
export function useMediaQuery(query) {
  const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
