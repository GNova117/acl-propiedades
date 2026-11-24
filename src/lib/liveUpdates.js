// Cambios en tiempo real del panel: llegan mensajes y prospectos nuevos sin recargar ni cambiar de pantalla.
// Un solo canal (db.subscribeToChanges: Supabase Realtime) reparte cada cambio a quien lo pidió. Esta parte es
// independiente del servidor para poder probarla: el «bus» reparte y `useLiveRefresh` hace que una pantalla se vuelva a
// consultar (con un pequeño retardo, para juntar varios cambios seguidos en una sola consulta).
import { useEffect, useState } from "react";

export function createLiveBus() {
  const listeners = new Set();
  return {
    // tables: ["contact_messages", ...] o null/[] para todas. → función para dejar de escuchar.
    subscribe(tables, callback) {
      const entry = { tables: tables?.length ? new Set(tables) : null, callback };
      listeners.add(entry);
      return () => listeners.delete(entry);
    },
    emit(event) {
      for (const { tables, callback } of [...listeners]) {
        if (!tables || tables.has(event?.table)) {
          try {
            callback(event);
          } catch {
            /* un oyente con error no debe callar a los demás */
          }
        }
      }
    },
    get size() {
      return listeners.size;
    },
  };
}

export const liveBus = createLiveBus();

// Abre el canal del backend y reparte lo que llegue. Devuelve cómo cerrarlo. Sin soporte en el backend no hace nada.
export function startLiveUpdates(db, bus = liveBus) {
  if (typeof db?.subscribeToChanges !== "function") return () => {};
  try {
    return db.subscribeToChanges((event) => bus.emit(event)) || (() => {});
  } catch {
    return () => {};
  }
}

// Número que cambia cuando llega un cambio de esas tablas (con `delayMs` de espera para juntar ráfagas): úsalo como
// dependencia de un efecto para volver a pedir los datos.
export function useLiveRefresh(tables, { delayMs = 1200, bus = liveBus } = {}) {
  const [tick, setTick] = useState(0);
  const key = (tables || []).join(",");
  useEffect(() => {
    let timer = null;
    const unsubscribe = bus.subscribe(key ? key.split(",") : null, () => {
      clearTimeout(timer);
      timer = setTimeout(() => setTick((n) => n + 1), delayMs);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [key, delayMs, bus]);
  return tick;
}
