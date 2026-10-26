import { useTranslation } from "react-i18next";
import { getPropertyBadge } from "../lib/propertyBadges";
import "./PropertyFlag.css";

// Etiqueta "Nuevo" / "Bajó de precio" de una propiedad disponible. No pinta
// nada si no aplica ninguna, así que se puede poner siempre.
export default function PropertyFlag({ property, className = "" }) {
  const { t } = useTranslation();
  const badge = getPropertyBadge(property);
  if (!badge) return null;
  const label =
    badge.kind === "priceDrop"
      ? badge.percent > 0
        ? t("badges.priceDropPct", { percent: badge.percent })
        : t("badges.priceDrop")
      : t("badges.new");
  return <span className={`property-flag property-flag--${badge.kind} ${className}`.trim()}>{label}</span>;
}
