import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Comparador de propiedades — mismo patrón que FavoritesContext (100%
// localStorage, sin cuenta ni backend): un visitante marca hasta
// MAX_COMPARE fichas desde cualquier tarjeta y las ve lado a lado en
// /comparar. Es un Context propio, no una extensión de Favoritos, porque
// son conceptos distintos: favoritos es una lista que se guarda para
// volver más tarde, comparar es una selección corta y temporal mientras
// se decide entre 2-4 opciones parecidas.
const STORAGE_KEY = "acl_compare";
export const MAX_COMPARE = 4;
const CompareContext = createContext(null);

function readCompare() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }) {
  const [compareIds, setCompareIds] = useState(readCompare);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) setCompareIds(readCompare());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const persist = (next) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage puede fallar (modo privado, cuota llena) — la
      // selección simplemente no persiste entre sesiones, no es crítico.
    }
  };

  // Devuelve false cuando no se pudo agregar (ya está en el tope) — el
  // botón que llama esto lo usa para avisar en vez de fallar en silencio.
  const toggleCompare = useCallback((propertyId) => {
    let added = true;
    setCompareIds((prev) => {
      if (prev.includes(propertyId)) {
        const next = prev.filter((id) => id !== propertyId);
        persist(next);
        return next;
      }
      if (prev.length >= MAX_COMPARE) {
        added = false;
        return prev;
      }
      const next = [...prev, propertyId];
      persist(next);
      return next;
    });
    return added;
  }, []);

  const removeFromCompare = useCallback((propertyId) => {
    setCompareIds((prev) => {
      const next = prev.filter((id) => id !== propertyId);
      persist(next);
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
    persist([]);
  }, []);

  const isComparing = useCallback((propertyId) => compareIds.includes(propertyId), [compareIds]);

  return (
    <CompareContext.Provider
      value={{ compareIds, toggleCompare, removeFromCompare, clearCompare, isComparing, isCompareFull: compareIds.length >= MAX_COMPARE }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare debe usarse dentro de CompareProvider");
  return ctx;
}
