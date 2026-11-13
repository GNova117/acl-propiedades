// Caché en memoria de las listas que casi todas las pantallas del panel piden
// (asesores, propiedades, clientes, prospectos, citas…), con el esquema «mostrar
// lo último y refrescar por detrás»: al entrar a una pantalla se pinta al
// instante lo que ya se había cargado y, en paralelo, se vuelve a pedir; cuando
// llega, todo lo que lo muestre se actualiza solo. Una lista pedida por una
// pantalla ya la tiene lista la siguiente (Prospectos → Mi día → Agenda…).
//
// Solo vive en memoria —nada de datos de clientes en el almacenamiento del
// navegador— y se vacía al cerrar o iniciar sesión (ver AuthContext), para que
// nadie vea lo de otra cuenta. Una entrada de más de MAX_AGE no se usa.
//
// Cada entrada: { value, at, error }. `mutate` cambia el valor ya cargado (lo que
// hace una pantalla tras guardar algo, sin volver a pedir todo). Una respuesta
// que llega después de un `mutate` hecho mientras viajaba se descarta: traería
// la lista de antes del cambio y lo borraría.

export const MAX_AGE = 30 * 60 * 1000;

const entries = new Map(); // key -> { value, at, error }
const listeners = new Map(); // key -> Set<fn>
const versions = new Map(); // key -> cuántos mutate van (para descartar respuestas viejas)
const latest = new Map(); // key -> id de la última petición lanzada
const inflight = new Map(); // key -> promesa de la petición en curso (para no repetirla al montar)
let requestId = 0;

const emit = (key) => listeners.get(key)?.forEach((fn) => fn());

// Lo guardado para `key`, o undefined si no hay o ya caducó. Estable entre llamadas
// mientras no cambie (lo necesita useSyncExternalStore).
export function snapshot(key) {
  const entry = entries.get(key);
  return entry && Date.now() - entry.at <= MAX_AGE ? entry : undefined;
}

export const peek = (key) => snapshot(key)?.value;

export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}

function put(key, value) {
  entries.set(key, { value, at: Date.now(), error: null });
  emit(key);
}

// Pide `fetcher()` y deja el resultado en la entrada. Sin `force`, si ya hay una
// petición de esa lista en curso se espera a esa (dos pantallas que piden lo mismo
// a la vez no repiten la consulta); con `force` (tras guardar algo) siempre sale una nueva
// y las anteriores dejan de contar. Devuelve el valor ya aplicado; si falla, el
// error queda en la entrada (sin borrar lo que ya hubiera) y se vuelve a lanzar.
export function revalidate(key, fetcher, { force = false } = {}) {
  if (!force && inflight.has(key)) return inflight.get(key);
  const id = ++requestId;
  latest.set(key, id);
  const version = versions.get(key) || 0;
  const promise = Promise.resolve()
    .then(fetcher)
    .then(
      (value) => {
        if (latest.get(key) === id && (versions.get(key) || 0) === version) put(key, value);
        return value;
      },
      (error) => {
        if (latest.get(key) === id) {
          const current = entries.get(key);
          entries.set(key, { value: current?.value, at: current?.at ?? Date.now(), error });
          emit(key);
        }
        throw error;
      }
    )
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

// Vuelve a pedir `key` solo si lo que hay tiene más de `minAge` ms (o no hay nada): para refrescar
// al volver a la app sin pedir de nuevo, una y otra vez, lo que se acaba de cargar.
export const FOCUS_REFRESH_MS = 20 * 1000;

export function refreshIfStale(key, fetcher, minAge = FOCUS_REFRESH_MS) {
  const entry = snapshot(key);
  if (entry && !entry.error && Date.now() - entry.at < minAge) return Promise.resolve();
  return revalidate(key, fetcher).catch(() => {});
}

// Cambia el valor ya cargado (`updater` recibe el actual). No hace nada si la
// lista todavía no se ha cargado: no hay a qué aplicarle el cambio.
export function mutate(key, updater) {
  const current = snapshot(key);
  if (!current || current.value === undefined) return;
  versions.set(key, (versions.get(key) || 0) + 1);
  put(key, typeof updater === "function" ? updater(current.value) : updater);
}

// Al cerrar o iniciar sesión: nada de una cuenta le sirve a otra.
export function clearDataCache() {
  const keys = [...entries.keys()];
  entries.clear();
  versions.clear();
  latest.clear();
  inflight.clear();
  keys.forEach(emit);
}
