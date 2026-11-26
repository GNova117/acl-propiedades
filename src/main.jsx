import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./fonts.css";
import "./index.css";
import "./utilities.css";
import { i18nReady } from "./i18n";
import { installDialogFocus } from "./lib/dialogFocus";
import { installErrorReporting } from "./lib/errorReporter";
import { db } from "./lib/dataStore";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { CompareProvider } from "./context/CompareContext";
import LoadingScreen from "./components/LoadingScreen";

// Después de un despliegue nuevo, una pestaña que ya tenía la página abierta
// puede intentar cargar un fragmento de código (Vite divide el bundle en
// varios archivos) cuyo nombre con hash ya no existe en el sitio actual —
// en vez de mostrarle al usuario el error crudo de "Failed to fetch
// dynamically imported module", se recarga la página una sola vez para
// traer la versión vigente. La bandera en sessionStorage evita un bucle si
// el problema fuera realmente de red y no de una versión vieja.
// Con el almacenamiento bloqueado (Safari con cookies bloqueadas) sessionStorage lanza: sin el try la app ni se montaba.
window.addEventListener("vite:preloadError", () => {
  try {
    if (sessionStorage.getItem("acl_reload_once")) return;
    sessionStorage.setItem("acl_reload_once", "1");
  } catch {
    return; // sin almacenamiento no hay forma de evitar un bucle de recargas: mejor no recargar
  }
  window.location.reload();
});
window.setTimeout(() => {
  try {
    sessionStorage.removeItem("acl_reload_once");
  } catch {
    /* sin almacenamiento */
  }
}, 3000);

// App instalable del panel: el service worker (public/sw.js) solo da la pantalla
// de "sin conexión" y guarda los archivos con hash; las páginas y los datos
// siempre vienen de la red. Solo en producción (en desarrollo estorbaría).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// La pantalla de marca solo sale en la primera visita de la sesión y en el sitio público: ni al volver a abrir una página, ni en el
// panel, ni en los enlaces privados (firma, documentos, visita, registro…), donde la persona viene a hacer algo y la espera estorba.
const SPLASH_KEY = "acl_splash_seen";
const NO_SPLASH = /^\/(admin|firmar|documentos|visita|opinion|seleccion|registro|informe)(\/|$)/;

function shouldShowSplash() {
  if (NO_SPLASH.test(window.location.pathname)) return false;
  try {
    if (sessionStorage.getItem(SPLASH_KEY)) return false;
    sessionStorage.setItem(SPLASH_KEY, "1");
  } catch {
    /* sin almacenamiento: se muestra, pero solo una vez por carga */
  }
  return true;
}

function Root() {
  const [showLoader, setShowLoader] = useState(shouldShowSplash);

  useEffect(() => {
    if (!showLoader) return undefined;
    const timer = setTimeout(() => setShowLoader(false), 1500);
    return () => clearTimeout(timer);
  }, [showLoader]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CompareProvider>
            <BrowserRouter>
              {showLoader && <LoadingScreen />}
              <App />
            </BrowserRouter>
          </CompareProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Foco del teclado en todas las ventanas emergentes (ver lib/dialogFocus.js).
installDialogFocus();
// Errores del navegador → /admin/errores (ver lib/errorReporter.js). En desarrollo no se mandan (ruido de recarga en caliente).
if (!import.meta.env.DEV) installErrorReporting((payload) => db.reportClientError(payload));

// El idioma activo ya debe estar cargado antes de pintar (el inglés se baja bajo demanda; ver src/i18n/index.js).
i18nReady.finally(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
});
