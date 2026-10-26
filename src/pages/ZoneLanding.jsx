import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Properties from "./Properties";
import NotFound from "./NotFound";
import ZoneStats from "../components/ZoneStats";
import { db } from "../lib/dataStore";
import { findCityBySlug } from "../lib/zoneLandingPages";
import { cityMarketSummary } from "../lib/zoneContext";

// Envoltura delgada de Properties.jsx: reutiliza todo el motor de
// filtros/orden/vista-mapa que ya existe para "/propiedades", solo le pasa
// un título dinámico, un filtro de ciudad (ver `cityFilter` en Properties.jsx)
// y la franja de mercado de la ciudad (ZoneStats).
export default function ZoneLanding() {
  const { t } = useTranslation();
  const { zoneSlug } = useParams();
  const city = findCityBySlug(zoneSlug);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!city) return undefined;
    let active = true;
    setSummary(null);
    db.getProperties({ activeOnly: true })
      .then((list) => {
        if (active) setSummary(cityMarketSummary(list, city));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [city]);

  if (!city) return <NotFound />;

  return (
    <Properties
      cityFilter={city}
      title={t("properties.zoneTitle", { city })}
      subtitle={t("properties.zoneSubtitle", { city })}
      headerExtra={<ZoneStats summary={summary} city={city} />}
    />
  );
}
