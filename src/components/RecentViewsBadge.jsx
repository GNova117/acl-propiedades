import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { shouldShowRecentViews } from "../lib/recentViews";
import "./RecentViewsBadge.css";

// Indicador discreto de prueba social en la ficha de propiedad: "N personas
// vieron esta propiedad en los últimos 3 días". Siempre con datos reales
// (db.trackPropertyView cuenta visitantes distintos, deduplicados por
// día) — nunca un número inventado; con pocas vistas simplemente no se
// muestra nada (ver shouldShowRecentViews).
export default function RecentViewsBadge({ propertyId }) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    db.trackPropertyView(propertyId)
      .then((recentCount) => active && setCount(recentCount))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [propertyId]);

  if (!shouldShowRecentViews(count)) return null;

  return (
    <p className="recent-views-badge">
      <span className="recent-views-badge__dot" aria-hidden="true" />
      {t("detail.recentViews", { count })}
    </p>
  );
}
