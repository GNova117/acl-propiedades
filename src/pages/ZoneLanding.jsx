import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Properties from "./Properties";
import NotFound from "./NotFound";
import { findCityBySlug } from "../lib/zoneLandingPages";

// Envoltura delgada de Properties.jsx: reutiliza todo el motor de
// filtros/orden/vista-mapa que ya existe para "/propiedades", solo le pasa
// un título dinámico y un filtro de ciudad (ver `cityFilter` en Properties.jsx).
export default function ZoneLanding() {
  const { t } = useTranslation();
  const { zoneSlug } = useParams();
  const city = findCityBySlug(zoneSlug);

  if (!city) return <NotFound />;

  return (
    <Properties
      cityFilter={city}
      title={t("properties.zoneTitle", { city })}
      subtitle={t("properties.zoneSubtitle", { city })}
    />
  );
}
