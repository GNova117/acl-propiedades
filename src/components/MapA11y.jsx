import { useEffect } from "react";
import { useMap } from "react-leaflet";

// 249: el contenedor de un mapa Leaflet recibe el foco del teclado (flechas = mover, +/− = acercar) pero no trae rol ni nombre,
// así que un lector de pantalla solo dice «grupo». Se le pone `role="region"` y una etiqueta que además explica cómo manejarlo.
// Va como hijo de <MapContainer>.
export default function MapA11y({ label }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", label);
    return () => {
      el.removeAttribute("aria-label");
      el.removeAttribute("role");
    };
  }, [map, label]);
  return null;
}
