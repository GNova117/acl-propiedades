// Service worker de la app instalable (panel de ACL Propiedades).
//
// Hace poco a propósito, para que un despliegue nuevo nunca se quede "pegado" con una versión vieja:
//  - Las páginas (HTML) se piden a la red. Solo si no hay conexión se muestra algo guardado: en el panel
//    (/admin…) la propia app, para que abra y se pueda capturar sin señal aunque la página se recargue; en el
//    resto del sitio, /offline.html con un botón para reintentar.
//  - Los archivos de /assets/ llevan un hash en el nombre (cambian en cada versión), así que se guardan y se
//    sirven al instante sin riesgo de quedar desactualizados.
//  - El panel, al abrirse con señal, pide guardar de antemano todo su código (mensaje "precache"): la lista sale
//    del build (/precache.json, ver scripts/precacheManifest.js). Así abre sin señal en cualquier pantalla, no
//    solo en las que ya se habían visitado.
//  - Todo lo demás (Supabase, WhatsApp, fuentes, imágenes de propiedades) se deja pasar sin tocarlo: los datos
//    nunca se guardan aquí.
const VERSION = "acl-sw-v2";
const STATIC_CACHE = `${VERSION}-static`;
const ASSETS_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline.html";
const SHELL_URL = "/index.html"; // la app: toda ruta del sitio responde este mismo archivo
const BUILD_KEY = "/__precache-build"; // huella del precaché completo (ver scripts/precacheManifest.js)
const PRECACHE_URL = "/precache.json";
const PRECACHE_PARALLEL = 6;
// Con la app ya guardada, una red que no contesta (barras pero sin datos) no deja esperando: tras esto se abre la guardada.
const NAV_TIMEOUT_MS = 5000;

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

const isPanelPath = (pathname) => pathname === "/admin" || pathname.startsWith("/admin/");

async function openPage(request, url) {
  const shell = isPanelPath(url.pathname) ? await caches.match(SHELL_URL) : null;
  try {
    const network = fetch(request);
    if (!shell) return await network;
    let timer;
    const slow = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("slow")), NAV_TIMEOUT_MS);
    });
    return await Promise.race([network, slow]).finally(() => clearTimeout(timer));
  } catch {
    return shell || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(openPage(request, url));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const hit = await cache.match(request, { ignoreVary: true });
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
  }
});

// ── Precaché del panel ──
// Se pide con registration.active.postMessage({ type: "precache" }) (ver src/lib/offlineShell.js). Es reanudable: lo
// que ya está guardado no se vuelve a bajar, y la huella solo se anota al terminar, junto con la app (index.html), así
// que una interrupción a medias nunca deja una app que apunte a archivos que faltan. Solo entonces se borran los
// archivos de versiones anteriores.
let precaching = null;

async function runPrecache() {
  const res = await fetch(PRECACHE_URL, { cache: "no-store" });
  if (!res.ok) return;
  const manifest = await res.json();
  if (!manifest?.build || !Array.isArray(manifest.assets)) return;

  const statics = await caches.open(STATIC_CACHE);
  const done = await statics.match(BUILD_KEY);
  if (done && (await done.text()) === manifest.build && (await statics.match(SHELL_URL))) return;

  const assets = await caches.open(ASSETS_CACHE);
  const queue = manifest.assets.filter((path) => typeof path === "string" && path.startsWith("/assets/"));
  let failed = false;
  const worker = async () => {
    while (queue.length && !failed) {
      const path = queue.shift();
      if (await assets.match(path, { ignoreVary: true })) continue;
      const file = await fetch(path);
      if (!file.ok) {
        failed = true;
        return;
      }
      await assets.put(path, file);
    }
  };
  await Promise.all(Array.from({ length: PRECACHE_PARALLEL }, worker));
  if (failed) return;

  const shell = await fetch(SHELL_URL, { cache: "reload" });
  if (!shell.ok || !(shell.headers.get("content-type") || "").includes("text/html")) return;
  // Una copia limpia: una respuesta que vino de una redirección no se puede entregar a una navegación.
  await statics.put(SHELL_URL, new Response(await shell.blob(), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
  await statics.put(BUILD_KEY, new Response(manifest.build));

  const keep = new Set(manifest.assets);
  for (const stored of await assets.keys()) {
    if (!keep.has(new URL(stored.url).pathname)) await assets.delete(stored);
  }
}

function precache() {
  if (!precaching) {
    precaching = runPrecache()
      .catch(() => {})
      .finally(() => {
        precaching = null;
      });
  }
  return precaching;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "precache") event.waitUntil(precache());
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
