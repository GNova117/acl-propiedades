import { useEffect, useState } from "react";

const QUERY = "(pointer: coarse)";

/**
 * true cuando el dispositivo principal de entrada es táctil (teléfono/tablet). Las asas y zonas de
 * agarre del plano se hacen más grandes ahí: un dedo no acierta a un círculo de 12 px.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setCoarse(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return coarse;
}
