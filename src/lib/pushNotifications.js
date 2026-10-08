// Notificaciones push del navegador/SO para el panel admin — ver README
// ("Notificaciones push") y supabase/schema.sql (tabla push_subscriptions,
// Edge Function enviar-push). Todo lo de aquí son operaciones del propio
// navegador (Service Worker + Push API, manejadas en public/sw.js); lo
// único que toca el backend es guardar/borrar la suscripción de este
// dispositivo (eso lo hace quien llama a estas funciones, vía `db`).

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID_PUBLIC_KEY);
}

// Convierte la llave pública VAPID (base64url, tal cual la da `npx web-push
// generate-vapid-keys`) al Uint8Array que pide pushManager.subscribe().
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

// Pide permiso (si hace falta) y crea la suscripción del navegador en este
// dispositivo. No la guarda en la base de datos — eso es responsabilidad de
// quien llama esto (ya tiene `db` importado y sabe con qué correo asociarla).
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error("Este navegador no soporta notificaciones push.");
  if (Notification.permission === "denied") {
    throw new Error("Las notificaciones están bloqueadas para este sitio — actívalas desde la configuración del navegador y vuelve a intentar.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("No se concedió el permiso de notificaciones.");

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

export async function unsubscribeFromPush() {
  const subscription = await getExistingSubscription();
  if (subscription) await subscription.unsubscribe();
  return subscription;
}

// Forma que push_subscriptions espera guardar, a partir de lo que entrega
// pushManager.subscribe()/getSubscription().
export function subscriptionToRow(subscription, email) {
  const json = subscription.toJSON();
  return {
    email,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    userAgent: navigator.userAgent,
  };
}
