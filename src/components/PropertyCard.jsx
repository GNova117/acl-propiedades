import FactIcon from "./FactIcon";
import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PropertyTypeIcon from "./PropertyTypeIcon";
import FavoriteButton from "./FavoriteButton";
import CompareButton from "./CompareButton";
import ShareButton from "./ShareButton";
import PropertyFlag from "./PropertyFlag";
import PropertyImageCarousel from "./PropertyImageCarousel";
import { cardImages } from "../lib/cardImages";
import { formatMXN, formatArea, propertyTypeLabel, propertyShareLines, statusBadgeClass } from "../lib/format";
import { getPropertyBadge } from "../lib/propertyBadges";
import { nextVisitTag } from "../lib/nextVisit";
import { estimateMonthlyPayment } from "../lib/monthlyEstimate";
import "./PropertyCard.css";
import { propertyPath } from "../lib/propertyUrl.js";
import { siteOrigin } from "../lib/site";

// `nextVisitSlot`: primer horario libre para visitarla ({ fecha, hora }); sale «Visítala hoy / mañana / el jueves».
// `soldInDays`: en «Vendidas recientemente», cuántos días tardó en venderse.
export default function PropertyCard({ property, nextVisitSlot, soldInDays }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  // De dónde viene la persona: la ficha lo usa para que «Volver» regrese a este listado con sus filtros.
  const linkState = { from: location.pathname + location.search };
  const advisor = property.advisors?.[0];
  const badge = getPropertyBadge(property);
  const monthly = estimateMonthlyPayment(property);
  const visitTag = property.status === "disponible" ? nextVisitTag(nextVisitSlot) : null;
  const shareUrl = typeof window !== "undefined" ? `${siteOrigin()}${propertyPath(property)}` : "";
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
      <Link to={propertyPath(property)} state={linkState} className="property-card__image-link">
        <PropertyImageCarousel images={cardImages(property)} alt={property.title} />
        <span className={`badge ${statusBadgeClass(property.status)} property-card__badge`}>
          {t(`propertyStatus.${property.status}`)}
        </span>
        <PropertyFlag property={property} className="property-flag--card" />
        {(property.images?.length || 0) > 1 && (
          <span className="property-card__photo-count">{t("propertyCard.photos", { count: property.images.length })}</span>
        )}
        <FavoriteButton propertyId={property.id} className="property-card__favorite" />
        <CompareButton propertyId={property.id} className="property-card__compare" />
      </Link>
      <div className="property-card__body">
        <div className="property-card__type">
          <PropertyTypeIcon type={property.type} size={16} />
          <span>{propertyTypeLabel(t, property.type)}</span>
          {property.zone && <span className="property-card__zone">· {property.zone}</span>}
          {property.code && <span className="property-card__code">{property.code}</span>}
        </div>
        <h3 className="property-card__title">
          <Link to={propertyPath(property)} state={linkState}>{property.title}</Link>
        </h3>
        <p className="property-card__price">
          {badge?.kind === "priceDrop" && <s className="property-price-was">{formatMXN(badge.previousPrice)}</s>}
          {formatMXN(property.price)}
          {property.operation_type === "renta" && <span className="property-price-period">{t("propertyOperation.perMonth")}</span>}
        </p>
        {monthly && (
          <p
            className="property-card__monthly"
            title={t("monthlyEstimate.hint", { down: monthly.downPct, years: monthly.years, rate: monthly.rate })}
          >
            {t("monthlyEstimate.perMonth", { amount: formatMXN(monthly.payment) })}
          </p>
        )}
        {property.status === "vendida" && soldInDays > 0 && (
          <p className="property-card__sold-days">{t("trust.soldInDays", { count: soldInDays })}</p>
        )}
        {visitTag && (
          <p className={`property-card__visit property-card__visit--${visitTag.kind}`}>
            <span aria-hidden="true">📅</span>{" "}
            {visitTag.kind === "weekday"
              ? t("nextVisit.weekday", { day: new Date(2024, 0, 7 + visitTag.weekday).toLocaleDateString(i18n.language === "en" ? "en-US" : "es-MX", { weekday: "long" }) })
              : t(`nextVisit.${visitTag.kind}`)}
          </p>
        )}
        <ul className="property-card__meta">
          <li><FactIcon name="area" />{formatArea(property.area_m2)}</li>
          {property.bedrooms != null && <li><FactIcon name="bed" />{property.bedrooms} {t("properties.bedrooms")}</li>}
          {property.bathrooms != null && <li><FactIcon name="bath" />{property.bathrooms} {t("properties.bathrooms")}</li>}
          {property.parking != null && property.type !== "nave_industrial" && <li><FactIcon name="car" />{property.parking} {t("properties.parking")}</li>}
        </ul>
        <div className="property-card__footer">
          {advisor ? (
            <div className="property-card__advisor">
              {advisor.photo_url && <img src={advisor.photo_url} alt={advisor.name} loading="lazy" decoding="async" />}
              <span>{advisor.name}</span>
            </div>
          ) : (
            <span />
          )}
          <div className="property-card__footer-actions">
            <ShareButton title={property.title} text={shareText} url={shareUrl} openUpward propertyId={property.id} />
            <Link to={propertyPath(property)} state={linkState} className="btn btn-outline btn-sm">
              {t("properties.viewDetail")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
