// Google Analytics 4 — opcional: si VITE_GA_MEASUREMENT_ID no está
// configurado (por ejemplo en desarrollo local o en modo demo), no se
// carga nada, así que el tráfico de pruebas nunca contamina las
// estadísticas reales. Solo se usa en el sitio público (PublicLayout en
// App.jsx) — el uso del panel admin por el propio equipo no es "tráfico"
// que valga la pena medir.
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

export function initAnalytics() {
  if (!GA_ID || initialized) return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // send_page_view en false porque cada navegación (incluida la primera)
  // se reporta a mano vía trackPageview, para que las rutas de React
  // Router (que no son recargas reales) también cuenten.
  window.gtag("config", GA_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

export function trackPageview(path) {
  if (!GA_ID || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", { page_path: path });
}
