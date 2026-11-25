import { useEffect, useState } from "react";

// Devuelve `value` con retraso: solo cambia cuando `value` lleva `delay` ms sin moverse. La primera vez es inmediato. Sirve para no
// pedir al servidor una consulta por cada tecla (escribir «1500000» eran 7 consultas).
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (Object.is(debounced, value)) return undefined;
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay, debounced]);
  return debounced;
}
