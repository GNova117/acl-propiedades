import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { developmentStats } from "../lib/developments";
import { formatMXN, formatArea } from "../lib/format";
import Logo from "./Logo";
import "./DevelopmentCard.css";

// Una torre completa como UNA sola tarjeta en el listado, en vez de una
// tarjeta por departamento. Se distingue de una propiedad normal por la
// insignia "Desarrollo", la etapa y el "Comercializa ACL" al pie.
export default function DevelopmentCard({ development }) {
  const { t } = useTranslation();
  const stats = developmentStats(development);
  const to = `/desarrollos/${development.slug}`;

  return (
    <article className="development-card card">
      <Link to={to} className="development-card__image-link">
        {development.hero_image && <img src={development.hero_image} alt={development.name} loading="lazy" decoding="async" />}
        <span className="development-card__badge">{t("developments.card.badge")}</span>
        <span className="development-card__stage">{t(`developments.stage.${development.stage}`)}</span>
      </Link>
      <div className="development-card__body">
        <p className="development-card__zone">{development.zone}</p>
        <h3 className="development-card__title">
          <Link to={to}>{development.name}</Link>
        </h3>
        {development.tagline && <p className="development-card__tagline">{development.tagline}</p>}
        <p className="development-card__price">
          {stats.fromPrice != null ? t("developments.card.from", { price: formatMXN(stats.fromPrice) }) : t("developments.card.soldOut")}
        </p>
        <ul className="development-card__meta">
          {stats.minBedrooms != null && (
            <li>
              {stats.minBedrooms === stats.maxBedrooms
                ? stats.minBedrooms
                : t("developments.range", { min: stats.minBedrooms, max: stats.maxBedrooms })}{" "}
              {t("properties.bedrooms")}
            </li>
          )}
          {stats.minArea != null && (
            <li>
              {stats.minArea === stats.maxArea ? formatArea(stats.minArea) : t("developments.range", { min: stats.minArea, max: formatArea(stats.maxArea) })}
            </li>
          )}
          <li>{t("developments.card.availability", { available: stats.available, total: stats.total })}</li>
        </ul>
        <div className="development-card__footer">
          <span className="development-card__seller">
            <Logo size="sm" />
          </span>
          <Link to={to} className="btn btn-outline btn-sm">
            {t("developments.card.view")}
          </Link>
        </div>
      </div>
    </article>
  );
}
