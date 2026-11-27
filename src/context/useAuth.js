import { createContext, useContext } from "react";

// Contexto y hook de Auth en su propio archivo (el proveedor vive en AuthContext.jsx): así los archivos de componentes solo
// exportan componentes y la recarga en caliente de Vite funciona.
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
