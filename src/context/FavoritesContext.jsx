import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Favoritos de visitante — 100% localStorage, sin cuenta ni backend (a
// diferencia de todo lo demás en el sitio, esto no necesita SQL). Vive en
// un Context propio (como ThemeContext/AuthContext) en vez de leerse
// directo de localStorage en cada componente, para que un corazón
// marcado en una tarjeta se refleje al instante en la ficha de la
// propiedad y en el contador del header sin recargar la página.
const STORAGE_KEY = "acl_favorites";
const FavoritesContext = createContext(null);

function readFavorites() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(readFavorites);

  // Si el visitante tiene el sitio abierto en dos pestañas, marcar un
  // favorito en una se refleja en la otra.
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) setFavorites(readFavorites());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleFavorite = useCallback((propertyId) => {
    setFavorites((prev) => {
      const next = prev.includes(propertyId) ? prev.filter((id) => id !== propertyId) : [...prev, propertyId];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage puede fallar (modo privado, cuota llena) — el
        // corazón simplemente no persiste entre sesiones, no es crítico.
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((propertyId) => favorites.includes(propertyId), [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites debe usarse dentro de FavoritesProvider");
  return ctx;
}
