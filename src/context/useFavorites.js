import { createContext, useContext } from "react";

// Contexto y hook de Favorites en su propio archivo (el proveedor vive en FavoritesContext.jsx): así los archivos de componentes solo
// exportan componentes y la recarga en caliente de Vite funciona.
export const FavoritesContext = createContext(null);

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites debe usarse dentro de FavoritesProvider");
  return ctx;
}
