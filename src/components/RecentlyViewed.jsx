import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { getRecentlyViewedIds } from "../lib/recentlyViewed";
import PropertyCard from "./PropertyCard";
import "./RecentlyViewed.css";

// "Vistos recientemente": los ids salen de localStorage, pero los datos de
// cada propiedad se piden frescos (precio/estatus/fotos actuales) y las que
// ya no existen o se desactivaron simplemente se omiten.
export default function RecentlyViewed({ excludeId, className = "" }) {
  const { t } = useTranslation();
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    const ids = getRecentlyViewedIds({ excludeId });
    if (ids.length === 0) {
      setProperties([]);
      return;
    }
    let active = true;
    Promise.all(ids.map((id) => db.getPropertyById(id).catch(() => null))).then((results) => {
      if (active) setProperties(results.filter((p) => p && p.active));
    });
    return () => {
      active = false;
    };
  }, [excludeId]);

  if (properties.length === 0) return null;

  return (
    <div className={`recently-viewed ${className}`}>
      <h2>{t("recentlyViewed.title")}</h2>
      <div className="recently-viewed__row">
        {properties.map((p) => (
          <div className="recently-viewed__item" key={p.id}>
            <PropertyCard property={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
