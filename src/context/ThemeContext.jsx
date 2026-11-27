import { useEffect, useState } from "react";
import { ThemeContext } from "./useTheme.js";

const STORAGE_KEY = "acl_theme";

function readStoredTheme() {
  // Con el almacenamiento bloqueado (Safari con cookies bloqueadas) leer o escribir lanza: sin este try el sitio entero quedaba en blanco.
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

const systemQuery = () => (typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined);

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  return readStoredTheme() || (systemQuery()?.matches ? "dark" : "light");
}

// El tema solo se guarda cuando la persona lo cambia con el botón. Mientras no lo haya elegido sigue al sistema (también si el
// sistema cambia de claro a oscuro con el sitio abierto); antes se guardaba en el primer render y desde ahí ya no lo seguía.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // La barra del navegador del teléfono sigue al tema (antes quedaba azul también en modo oscuro).
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0a1120" : "#0d3b73");
  }, [theme]);

  useEffect(() => {
    const query = systemQuery();
    if (!query?.addEventListener) return undefined;
    const onChange = (event) => {
      if (!readStoredTheme()) setTheme(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = () =>
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* sin almacenamiento: el tema vale solo en esta visita */
      }
      return next;
    });

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

