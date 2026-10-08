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

// Notificaciones push (ver src/lib/pushNotifications.js y
// supabase/functions/enviar-push). El payload lo arma esa función con
// { title, body, url } en JSON — si algo viniera mal formado, se muestra
// una notificación genérica en vez de que el evento truene sin avisar nada.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "ACL Propiedades";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/admin" },
    })
  );
});

// Al dar clic, enfoca una pestaña del panel ya abierta si existe; si no, abre una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).pathname === url);
      if (existing) return existing.focus();
      if (clients.length > 0 && "navigate" in clients[0]) return clients[0].navigate(url).then((c) => c.focus());
      return self.clients.openWindow(url);
    })
  );
});
