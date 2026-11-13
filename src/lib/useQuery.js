import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import i18next from "i18next";
import { mutate, refreshIfStale, revalidate, snapshot, subscribe } from "./dataCache";
import { isOfflineError } from "./offlineQueue";

const noop = () => {};

// Sin señal, «TypeError: Failed to fetch» no le dice nada al asesor: el error de red se cambia por un aviso claro (el original queda en `cause`).
function friendlyError(error) {
  if (!error || !isOfflineError(error)) return error || null;
  return Object.assign(new Error(i18next.t("offline.loadFailed")), { cause: error, offline: true });
}

// Una lista del panel con «mostrar lo último y refrescar por detrás» (ver dataCache.js).
// `query`: { key, fetch } de queries.js. Con `enabled: false` no pide nada (p. ej. una
// lista a la que el rol no tiene acceso).
//   data     — la lista (undefined mientras no hay nada que mostrar)
//   loading  — true solo la primera vez, cuando todavía no hay nada: con algo en el
//              caché la pantalla se pinta al instante y se actualiza al llegar lo nuevo
//   error    — el último error al pedirla (conserva `data` si ya la había)
//   reload() — vuelve a pedirla y espera a que quede aplicada (tras guardar algo)
//   mutate(f)— cambia la lista ya cargada sin volver a pedirla (f recibe la actual)
// Además se refresca sola al volver a la app (visibilitychange) si lleva más de FOCUS_REFRESH_MS cargada.
export function useQuery(query, { enabled = true } = {}) {
  const key = enabled && query ? query.key : null;
  const fetchRef = useRef(query?.fetch);
  fetchRef.current = query?.fetch;

  const entry = useSyncExternalStore(
    useCallback((onChange) => (key ? subscribe(key, onChange) : noop), [key]),
    () => (key ? snapshot(key) : undefined),
    () => (key ? snapshot(key) : undefined)
  );

  // Al entrar (y si cambia la lista): se vuelve a pedir aunque ya haya algo en el caché.
  useEffect(() => {
    if (key) revalidate(key, () => fetchRef.current()).catch(noop);
  }, [key]);

  // Al volver a la app (de WhatsApp, de una llamada, de otra pestaña) se refresca lo que ya llevaba
  // un rato cargado: los prospectos nuevos del sitio aparecen sin tener que cambiar de pantalla.
  useEffect(() => {
    if (!key) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshIfStale(key, () => fetchRef.current());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [key]);

  const error = useMemo(() => friendlyError(entry?.error), [entry?.error]);
  const reload = useCallback(() => (key ? revalidate(key, () => fetchRef.current(), { force: true }) : Promise.resolve()), [key]);
  const change = useCallback((updater) => key && mutate(key, updater), [key]);

  return { data: entry?.value, loading: Boolean(key) && !entry, error, reload, mutate: change };
}
