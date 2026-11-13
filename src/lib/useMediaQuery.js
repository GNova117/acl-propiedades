import { useEffect, useState } from "react";

// ¿Se cumple esta media query ahora? Se actualiza sola al cambiar (girar el teléfono, cambiar el tamaño de la ventana, conectar un
// ratón). Sin matchMedia (pruebas, navegadores raros) responde `fallback`.
export function useMediaQuery(query, fallback = false) {
  const read = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : fallback);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return matches;
}
