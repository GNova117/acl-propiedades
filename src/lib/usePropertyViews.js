import { useEffect, useState } from "react";
import { db } from "./dataStore";

// Registra la vista de una propiedad (un visitante distinto por día) y devuelve cuántas personas la vieron en los últimos
// días. Vive aparte del indicador (RecentViewsBadge) a propósito: si alguien quita o cambia el indicador, la vista se
// sigue registrando y no se pierden los datos del informe del vendedor.
export function usePropertyViews(propertyId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    db.trackPropertyView(propertyId)
      .then((recentCount) => active && setCount(recentCount))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [propertyId]);
  return count;
}
