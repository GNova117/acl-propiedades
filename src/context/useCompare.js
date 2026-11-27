import { createContext, useContext } from "react";

// Contexto y hook de Compare en su propio archivo (el proveedor vive en CompareContext.jsx): así los archivos de componentes solo
// exportan componentes y la recarga en caliente de Vite funciona.
export const MAX_COMPARE = 4;
export const CompareContext = createContext(null);

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare debe usarse dentro de CompareProvider");
  return ctx;
}
