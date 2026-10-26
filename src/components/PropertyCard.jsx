import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PropertyTypeIcon from "./PropertyTypeIcon";
import FavoriteButton from "./FavoriteButton";
import CompareButton from "./CompareButton";
import ShareButton from "./ShareButton";
import PropertyFlag from "./PropertyFlag";
import { formatMXN, formatArea, propertyTypeLabel, propertyShareLines } from "../lib/format";
import { getPropertyBadge } from "../lib/propertyBadges";
import { estimateMonthlyPayment } from "../lib/monthlyEstimate";
import "./PropertyCard.css";

export default function PropertyCard({ property }) {
  const { t } = useTranslation();
  const advisor = property.advisors?.[0];
  const badge = getPropertyBadge(property);
  const monthly = estimateMonthlyPayment(property);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/propiedades/${property.id}` : "";
  // Mismo formato que el botón de Compartir de la ficha de propiedad, pero
  // sin amenidades (la tarjeta de listado no las trae cargadas) — para que
  // alguien pueda reenviar una propiedad desde los resultados o sus
  // favoritos sin tener que abrir la ficha primero.
  const shareText = useMemo(() => {
    const lines = propertyShareLines(property, t);
    lines.push("", shareUrl);
    return lines.join("\n");
  }, [property, t, shareUrl]);

  return (
    <article className="property-card card">
      <Link to={`/propiedades/${property.id}`} className="property-card__image-link">
        <img src={property.main_image} alt={property.title} loading="lazy" decoding="async" />
        <span className={`badge badge-${property.status === "disponible" ? "available" : property.status === "apartada" ? "reserved" : "sold"} property-card__badge`}>
          {t(`propertyStatus.${property.status}`)}
        </span>
        <PropertyFlag property={property} className="property-flag--card" />
        <FavoriteButton propertyId={property.id} className="property-card__favorite" />
        <CompareButton propertyId={property.id} className="property-card__compare" />
      </Link>
      <div className="property-card__body">
        <div className="property-card__type">
          <PropertyTypeIcon type={property.type} size={16} />
          <span>{propertyTypeLabel(t, property.type)}</span>
          <span className="property-card__zone">· {property.zone}</span>
        </div>
        <h3 className="property-card__title">
          <Link to={`/propiedades/${property.id}`}>{property.title}</Link>
        </h3>
        <p className="property-card__price">
          {badge?.kind === "priceDrop" && <s className="property-price-was">{formatMXN(badge.previousPrice)}</s>}
          {formatMXN(property.price)}
        </p>
        {monthly && (
          <p
            className="property-card__monthly"
            title={t("monthlyEstimate.hint", { down: monthly.downPct, years: monthly.years, rate: monthly.rate })}
          >
            {t("monthlyEstimate.perMonth", { amount: formatMXN(monthly.payment) })}
          </p>
        )}
        <ul className="property-card__meta">
          <li>{formatArea(property.area_m2)}</li>
          {property.bedrooms != null && <li>{property.bedrooms} {t("properties.bedrooms")}</li>}
          {property.bathrooms != null && <li>{property.bathrooms} {t("properties.bathrooms")}</li>}
        </ul>
        <div className="property-card__footer">
          {advisor ? (
            <div className="property-card__advisor">
              <img src={advisor.photo_url} alt={advisor.name} loading="lazy" decoding="async" />
              <span>{advisor.name}</span>
            </div>
          ) : (
            <span />
          )}
          <div className="property-card__footer-actions">
            <ShareButton title={property.title} text={shareText} url={shareUrl} openUpward />
            <Link to={`/propiedades/${property.id}`} className="btn btn-outline btn-sm">
              {t("properties.viewDetail")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
