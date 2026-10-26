import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatMXN } from "../lib/format";
import { zonePriceStats, comparePricePerM2 } from "../lib/zoneContext";
import { NEARBY_CATEGORIES, NEARBY_RADIUS_M, formatDistance, hasNearbyData } from "../lib/nearbyPlaces";
import "./ZoneContext.css";

const CATEGORY_ICON = { schools: "🏫", health: "🏥", shopping: "🛒", parks: "🌳" };

// "La zona" en la ficha de propiedad: cómo está su precio por m² frente a lo
// típico de la colonia (con las propiedades publicadas) y qué hay a menos de
// 1.5 km (OpenStreetMap vía /api/nearby-places). Cada mitad aparece solo si
// hay datos: sin comparables o sin respuesta del servicio, no se pinta nada.
export default function ZoneContext({ property }) {
  const { t } = useTranslation();
  const [market, setMarket] = useState(null);
  const [nearby, setNearby] = useState(null);

  useEffect(() => {
    let active = true;
    db.getProperties({ activeOnly: true, type: property.type })
      .then((list) => {
        if (!active) return;
        const stats = zonePriceStats(property, list);
        setMarket(stats ? { stats, comparison: comparePricePerM2(property, stats) } : null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [property]);

  useEffect(() => {
    if (!Number.isFinite(Number(property.lat)) || !Number.isFinite(Number(property.lng))) return undefined;
    const controller = new AbortController();
    fetch(`/api/nearby-places?lat=${property.lat}&lng=${property.lng}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.available && hasNearbyData(data.places)) setNearby(data.places);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [property.lat, property.lng]);

  if (!market?.comparison && !nearby) return null;

  return (
    <section className="zone-context">
      <h2>{t("zoneContext.title")}</h2>

      {market?.comparison && (
        <div className="zone-context__price card">
          <h3>{t("zoneContext.pricePerM2")}</h3>
          <div className="zone-context__price-row">
            <div>
              <strong>{formatMXN(market.comparison.ownPerM2)}</strong>
              <span>{t("zoneContext.thisProperty")}</span>
            </div>
            <div>
              <strong>{formatMXN(market.stats.medianPerM2)}</strong>
              <span>{t("zoneContext.typical", { label: market.stats.label })}</span>
            </div>
          </div>
          <p className={`zone-context__verdict zone-context__verdict--${market.comparison.verdict}`}>
            {t(`zoneContext.verdict.${market.comparison.verdict}`, { pct: Math.abs(market.comparison.diffPct), label: market.stats.label })}
          </p>
          <p className="form-hint">{t("zoneContext.basedOn", { count: market.stats.count })}</p>
        </div>
      )}

      {nearby && (
        <div className="zone-context__nearby card">
          <h3>{t("zoneContext.nearbyTitle", { distance: formatDistance(NEARBY_RADIUS_M) })}</h3>
          <ul>
            {NEARBY_CATEGORIES.filter((c) => nearby[c.key]?.count > 0).map((c) => (
              <li key={c.key}>
                <span className="zone-context__icon" aria-hidden="true">{CATEGORY_ICON[c.key]}</span>
                <div>
                  <strong>{t(`zoneContext.categories.${c.key}`, { count: nearby[c.key].count })}</strong>
                  {nearby[c.key].nearest.length > 0 && (
                    <span>{nearby[c.key].nearest.map((p) => `${p.name} (${formatDistance(p.distanceM)})`).join(" · ")}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="form-hint">
            {t("zoneContext.attribution")}{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
          </p>
        </div>
      )}
    </section>
  );
}
