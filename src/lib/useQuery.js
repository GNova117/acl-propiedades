import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { mutate, revalidate, snapshot, subscribe } from "./dataCache";

const noop = () => {};

// Una lista del panel con «mostrar lo último y refrescar por detrás» (ver dataCache.js).
// `query`: { key, fetch } de queries.js. Con `enabled: false` no pide nada (p. ej. una
// lista a la que el rol no tiene acceso).
//   data     — la lista (undefined mientras no hay nada que mostrar)
//   loading  — true solo la primera vez, cuando todavía no hay nada: con algo en el
//              caché la pantalla se pinta al instante y se actualiza al llegar lo nuevo
//   error    — el último error al pedirla (conserva `data` si ya la había)
//   reload() — vuelve a pedirla y espera a que quede aplicada (tras guardar algo)
//   mutate(f)— cambia la lista ya cargada sin volver a pedirla (f recibe la actual)
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

  const reload = useCallback(() => (key ? revalidate(key, () => fetchRef.current(), { force: true }) : Promise.resolve()), [key]);
  const change = useCallback((updater) => key && mutate(key, updater), [key]);

  return { data: entry?.value, loading: Boolean(key) && !entry, error: entry?.error || null, reload, mutate: change };
}
