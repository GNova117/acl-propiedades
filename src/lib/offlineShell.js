// «Abrir sin señal»: pide al service worker (public/sw.js) que guarde de antemano el código del panel, para que la app
// abra aunque se recargue sin conexión (solo se necesita haberla abierto una vez con señal). El service worker ya
// sabe qué guardar (/precache.json lo genera el build) y no repite lo que ya tiene, así que llamar de más no cuesta.

// ¿Conviene bajarlo ahora? No en desarrollo (no hay service worker), sin red, ni con «ahorro de datos» activado.
export function canPrecache() {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (navigator.onLine === false) return false;
  return !navigator.connection?.saveData;
}

export async function requestPrecache() {
  if (!canPrecache()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) return false;
    registration.active.postMessage({ type: "precache" });
    return true;
  } catch {
    return false;
  }
}

// Pide el precaché poco después de abrir el panel (para no competir con lo que se está viendo) y otra vez cada vez que
// vuelve la señal (por si se interrumpió). Devuelve la función que lo desactiva.
export function startPrecache({ delayMs = 4000 } = {}) {
  const timer = window.setTimeout(requestPrecache, delayMs);
  const onOnline = () => requestPrecache();
  window.addEventListener("online", onOnline);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("online", onOnline);
  };
}
