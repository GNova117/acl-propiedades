import { useTranslation } from "react-i18next";
import { shouldShowRecentViews } from "../lib/recentViews";
import "./RecentViewsBadge.css";

// Indicador discreto de prueba social en la ficha de propiedad: "N personas
// vieron esta propiedad en los últimos 3 días". Siempre con datos reales
// (el conteo viene de usePropertyViews, que también registra la vista) — nunca
// un número inventado; con pocas vistas simplemente no se muestra nada (ver
// shouldShowRecentViews). Es solo presentación: registrar la vista NO depende de él.
export default function RecentViewsBadge({ count }) {
  const { t } = useTranslation();

  if (!shouldShowRecentViews(count)) return null;

  return (
    <p className="recent-views-badge">
      <span className="recent-views-badge__dot" aria-hidden="true" />
      {t("detail.recentViews", { count })}
    </p>
  );
}
