import { useEffect, useState } from "react";
import { db } from "./dataStore";
import { resolveSession } from "./authStartup";

// ¿Hay una sesión de personal abierta en este navegador? Se pregunta SOLO cuando hace falta (`enabled`), por ejemplo al abrir
// una propiedad desactivada: el sitio público ya no arranca el proveedor de sesión (AuthProvider vive solo en el panel), así que
// cada visitante se ahorra inicializar Supabase Auth sin necesitarlo. → { has, checking }
export function useHasSession(enabled) {
  const [state, setState] = useState({ has: false, checking: Boolean(enabled) });
  useEffect(() => {
    if (!enabled) {
      setState({ has: false, checking: false });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, checking: true }));
    resolveSession(db)
      .then(({ session }) => !cancelled && setState({ has: Boolean(session), checking: false }))
      .catch(() => !cancelled && setState({ has: false, checking: false }));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return state;
}
