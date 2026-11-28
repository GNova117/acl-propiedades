import { createContext, useContext } from "react";

// Contexto y hook de Theme en su propio archivo (el proveedor vive en ThemeContext.jsx): así los archivos de componentes solo
// exportan componentes y la recarga en caliente de Vite funciona.
export const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
