// Monitoreo de errores del navegador: cuando algo truena en producción, queda registrado (con su pantalla, su navegador y
// cuántas veces pasó) en /admin/errores y se avisa por correo a los administradores. Sin servicios de terceros: se guarda en
// la propia base (tabla client_errors; ver «Monitoreo de errores» en schema.sql).
// Esta parte es pura (se prueba sin navegador): huella del error, limpieza de la dirección, qué se ignora y el freno.

// Segmentos de dirección que llevan un enlace secreto (token): nunca se mandan.
const TOKEN_PREFIXES = ["visita", "opinion", "firmar", "documentos", "seleccion", "baja", "restablecer", "informe", "reporte", "portal", "agenda-feed"];

// «https://x/visita/abc123?x=1#y» → «/visita/:token». Solo la ruta, sin parámetros ni fragmento.
export function sanitizeUrl(url) {
  let path = String(url || "");
  try {
    path = new URL(path, "https://sitio.local").pathname;
  } catch {
    path = path.split(/[?#]/)[0];
  }
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i += 1) {
    if (TOKEN_PREFIXES.includes(parts[i - 1]) && parts[i]) parts[i] = ":token";
  }
  return parts.join("/").slice(0, 300) || "/";
}

// Ruido que no es un fallo de la aplicación (extensiones del navegador, avisos benignos, red caída).
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?\s*$/im, /Non-Error promise rejection/i, /chrome-extension:|moz-extension:|safari-extension:/i, /AbortError/i, /Loading chunk .* failed|Importing a module script failed|error loading dynamically imported module/i];

export function shouldIgnore(message, stack = "") {
  const text = `${message || ""}\n${stack || ""}`;
  return IGNORED.some((re) => re.test(text));
}

// Huella corta (FNV-1a) del mismo error: mensaje sin números/identificadores + primera línea útil de la pila sin columnas.
export function fingerprintOf({ message = "", stack = "", source = "window" }) {
  const normalizedMessage = String(message).replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/gi, "<id>").replace(/\d+/g, "#").slice(0, 200);
  const firstFrame =
    String(stack)
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /^at |@/.test(l)) || "";
  const normalizedFrame = firstFrame.replace(/:\d+:\d+\)?$/, "").replace(/[0-9a-f]{8,}/gi, "<h>").slice(0, 200);
  const text = `${source}|${normalizedMessage}|${normalizedFrame}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// Arma lo que se manda: nunca el contenido de formularios ni datos personales, solo mensaje, pila, ruta y navegador.
export function buildErrorPayload(error, { source = "window", url, userAgent, release } = {}) {
  const message = String(error?.message ?? error ?? "Error desconocido").slice(0, 500);
  const stack = String(error?.stack || "").slice(0, 4000);
  return {
    fingerprint: fingerprintOf({ message, stack, source }),
    message,
    stack,
    source,
    url: sanitizeUrl(url),
    user_agent: String(userAgent || "").slice(0, 300),
    release: String(release || "").slice(0, 40),
  };
}

// Freno en el navegador: el mismo error una sola vez por carga de página y, en total, como mucho `maxPerMinute`.
export function createReporter({ send, now = () => Date.now(), maxPerMinute = 5 }) {
  const seen = new Set();
  const sentAt = [];
  return function report(payload) {
    if (!payload || shouldIgnore(payload.message, payload.stack)) return false;
    if (seen.has(payload.fingerprint)) return false;
    const t = now();
    while (sentAt.length && t - sentAt[0] > 60_000) sentAt.shift();
    if (sentAt.length >= maxPerMinute) return false;
    seen.add(payload.fingerprint);
    sentAt.push(t);
    Promise.resolve(send(payload)).catch(() => {}); // reportar nunca debe causar otro error
    return true;
  };
}

// ── Instalación en el navegador ──
// `send`: función que manda el payload (db.reportClientError). Se instala una vez; también devuelve `reportError` para
// que ErrorBoundary registre los errores de render. Fuera del navegador (pruebas) no hace nada.
let reporter = null;

export function reportError(error, { source = "react" } = {}) {
  if (!reporter) return false;
  return reporter(buildErrorPayload(error, { source, url: window.location.href, userAgent: navigator.userAgent, release: typeof __RELEASE__ === "undefined" ? "" : __RELEASE__ }));
}

export function installErrorReporting(send) {
  if (typeof window === "undefined" || reporter) return;
  reporter = createReporter({ send });
  window.addEventListener("error", (event) => {
    // Errores de carga de recursos (img/script) no traen `error`: se ignoran, no son del código.
    if (!event.error && !event.message) return;
    reportError(event.error || event.message, { source: "window" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "promise" });
  });
}
