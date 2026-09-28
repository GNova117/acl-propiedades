// Service worker de la app instalable (panel de ACL Propiedades).
//
// Hace lo MÍNIMO a propósito, para que un despliegue nuevo nunca se quede
// "pegado" con una versión vieja:
//  - Las páginas (HTML) siempre se piden a la red. Solo si no hay conexión se
//    muestra /offline.html, con un botón para reintentar.
//  - Los archivos de /assets/ llevan un hash en el nombre (cambian en cada
//    versión), así que se guardan y se sirven al instante sin riesgo de
//    quedar desactualizados.
//  - Todo lo demás (Supabase, WhatsApp, fuentes, imágenes de propiedades) se
//    deja pasar sin tocarlo: los datos nunca se guardan aquí.
const VERSION = "acl-sw-v1";
const STATIC_CACHE = `${VERSION}-static`;
const ASSETS_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
  }
});
