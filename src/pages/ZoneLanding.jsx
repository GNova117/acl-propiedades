import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Properties from "./Properties";
import NotFound from "./NotFound";
import ZoneStats from "../components/ZoneStats";
import { db } from "../lib/dataStore";
import { coloniesWithListings, findCityBySlug, findColonyZone, splitColonyZone } from "../lib/zoneLandingPages";
import { cityMarketSummary, colonyMarketSummary } from "../lib/zoneContext";
import "./ZoneLanding.css";

// Envoltura delgada de Properties.jsx: reutiliza todo el motor de filtros/orden/vista-mapa de "/propiedades". Sirve dos
// direcciones: la de una ciudad ("/propiedades/zona/torreon") y la de una colonia ("/propiedades/zona/torreon/las-villas").
// La ciudad lleva la franja de mercado y los enlaces a sus colonias; la colonia, su propia franja y un enlace a la ciudad.
export default function ZoneLanding() {
  const { t } = useTranslation();
  const { zoneSlug, colonySlug } = useParams();
  const city = findCityBySlug(zoneSlug);
  const [list, setList] = useState(null);
  const [zoneNames, setZoneNames] = useState(null);

  useEffect(() => {
    if (!city) return undefined;
    let active = true;
    db.getProperties({ activeOnly: true })
      .then((rows) => active && setList(rows))
      .catch(() => active && setList([]));
    return () => {
      active = false;
    };
  }, [city]);

  useEffect(() => {
    if (!colonySlug) return undefined;
    let active = true;
    db.getZones()
      .then((zones) => active && setZoneNames(zones.map((z) => z.name)))
      .catch(() => active && setZoneNames([]));
    return () => {
      active = false;
    };
  }, [colonySlug]);

  if (!city) return <NotFound />;

  if (colonySlug) {
    if (zoneNames === null) return null;
    const zoneName = findColonyZone(zoneNames, zoneSlug, colonySlug);
    if (!zoneName) return <NotFound />;
    const { colony } = splitColonyZone(zoneName);
    const summary = list ? colonyMarketSummary(list, zoneName) : null;
    return (
      <Properties
        zoneFilter={zoneName}
        // Una colonia sin propiedades disponibles no se indexa: sería una página casi vacía.
        noindex={list !== null && !summary}
        title={t("properties.colonyTitle", { colony, city })}
        subtitle={t("properties.colonySubtitle", { colony, city })}
        headerExtra={
          <>
            <ZoneStats summary={summary} city={colony} />
            <p className="zone-landing__back">
              <Link to={`/propiedades/zona/${zoneSlug}`}>{t("properties.colonyBack", { city })}</Link>
            </p>
          </>
        }
      />
    );
  }

  const summary = list ? cityMarketSummary(list, city) : null;
  const colonies = list ? coloniesWithListings(list, city) : [];
  return (
    <Properties
      cityFilter={city}
      title={t("properties.zoneTitle", { city })}
      subtitle={t("properties.zoneSubtitle", { city })}
      headerExtra={
        <>
          <ZoneStats summary={summary} city={city} />
          {colonies.length > 0 && (
            <nav className="zone-landing__colonies" aria-label={t("properties.coloniesTitle", { city })}>
              <h3>{t("properties.coloniesTitle", { city })}</h3>
              <ul>
                {colonies.map(({ zone, colony, count, path }) => (
                  <li key={zone}>
                    <Link to={path}>
                      {colony} <span>({count})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      }
    />
  );
}
