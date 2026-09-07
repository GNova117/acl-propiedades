import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./i18n";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
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

function Root() {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          {showLoader && <LoadingScreen />}
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
