import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PropertyTypeIcon from "./PropertyTypeIcon";
import { formatMXN, formatArea, propertyTypeLabel } from "../lib/format";
import "./PropertyCard.css";

export default function PropertyCard({ property }) {
  const { t } = useTranslation();
  const advisor = property.advisors?.[0];

  return (
    <article className="property-card card">
      <Link to={`/propiedades/${property.id}`} className="property-card__image-link">
        <img src={property.main_image} alt={property.title} loading="lazy" />
        <span className={`badge badge-${property.status === "disponible" ? "available" : property.status === "apartada" ? "reserved" : "sold"} property-card__badge`}>
          {t(`propertyStatus.${property.status}`)}
        </span>
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
        <p className="property-card__price">{formatMXN(property.price)}</p>
        <ul className="property-card__meta">
          <li>{formatArea(property.area_m2)}</li>
          {property.bedrooms != null && <li>{property.bedrooms} {t("properties.bedrooms")}</li>}
          {property.bathrooms != null && <li>{property.bathrooms} {t("properties.bathrooms")}</li>}
        </ul>
        <div className="property-card__footer">
          {advisor ? (
            <div className="property-card__advisor">
              <img src={advisor.photo_url} alt={advisor.name} />
              <span>{advisor.name}</span>
            </div>
          ) : (
            <span />
          )}
          <Link to={`/propiedades/${property.id}`} className="btn btn-outline btn-sm">
            {t("properties.viewDetail")}
          </Link>
        </div>
      </div>
    </article>
  );
}
