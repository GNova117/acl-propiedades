// Elige el manifiesto de la app instalable según la zona del sitio: /admin → «ACL Panel»; el resto → «ACL Propiedades».
// Es un archivo aparte (y no un script dentro de index.html) porque la política de seguridad no permite scripts en línea;
// va en el <head> justo después del <link rel="manifest"> para correr antes de que el navegador lo lea.
// La misma regla está en src/lib/manifest.js (que la repite al navegar sin recargar): si cambias una, cambia la otra.
(function () {
  var path = location.pathname;
  var admin = path === "/admin" || path.indexOf("/admin/") === 0;
  var link = document.querySelector('link[rel="manifest"]');
  if (link) link.setAttribute("href", admin ? "/manifest.webmanifest" : "/manifest-public.webmanifest");
  var title = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (title) title.setAttribute("content", admin ? "ACL Panel" : "ACL Propiedades");
})();
