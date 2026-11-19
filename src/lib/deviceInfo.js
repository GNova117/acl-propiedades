// Identificación sencilla del dispositivo para la lista de «dispositivos con sesión» (no es una huella: solo un nombre
// legible y un identificador al azar que este navegador guarda para reconocerse).
const DEVICE_KEY = "acl_device_id";

export function getDeviceId(storage = typeof localStorage === "undefined" ? null : localStorage) {
  try {
    let id = storage?.getItem(DEVICE_KEY);
    if (!id || id.length < 8) {
      id = crypto.randomUUID();
      storage?.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "sin-almacenamiento-" + Math.random().toString(36).slice(2, 10);
  }
}

// «Chrome en Windows», «Safari en iPhone»… a partir del user agent.
export function deviceLabel(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  const ua = String(userAgent || "");
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const system = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} en ${system}` : browser;
}
