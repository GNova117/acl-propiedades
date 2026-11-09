import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { HOME_CHANGE_EVENT, canUseMyDay, readHomePref, resolveAdminHome, writeHomePref } from "./adminHome";

// Inicio del panel ("mi-dia" o "panel") para quien tiene la sesión, y cómo
// cambiarlo. Se avisa con un evento para que el menú y la pantalla de Mi día
// se enteren al instante sin recargar.
export function useAdminHome() {
  const { hasSection, advisorId } = useAuth();
  const [stored, setStored] = useState(readHomePref);

  useEffect(() => {
    const onChange = () => setStored(readHomePref());
    window.addEventListener(HOME_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(HOME_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const canMyDay = canUseMyDay(hasSection);
  return { home: resolveAdminHome({ stored, advisorId, canMyDay }), canMyDay, setHome: writeHomePref };
}
