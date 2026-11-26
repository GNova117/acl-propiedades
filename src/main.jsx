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
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("acl_reload_once")) return;
  sessionStorage.setItem("acl_reload_once", "1");
  window.location.reload();
});
window.setTimeout(() => sessionStorage.removeItem("acl_reload_once"), 3000);

// App instalable del panel: el service worker (public/sw.js) solo da la pantalla
// de "sin conexión" y guarda los archivos con hash; las páginas y los datos
// siempre vienen de la red. Solo en producción (en desarrollo estorbaría).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function Root() {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 1500);
    return () => clearTimeout(timer);
  }, []);

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

// Se espera a i18n (y al bundle en inglés cuando el idioma es inglés) para no mostrar un destello de español.
// Si la descarga del inglés falla, i18nReady igual resuelve y el sitio abre en español.
i18nReady
  .catch(() => {})
  .then(() => {
    createRoot(document.getElementById("root")).render(
      <StrictMode>
        <Root />
      </StrictMode>
    );
  });
