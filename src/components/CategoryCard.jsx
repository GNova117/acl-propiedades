import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PropertyTypeIcon from "./PropertyTypeIcon";
import "./CategoryCard.css";

const IMAGES = {
  casa: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80",
  departamento: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80",
  nave_industrial: "https://images.unsplash.com/photo-1601599963565-b7f49deb2748?w=900&q=80",
};

export default function CategoryCard({ type, count }) {
  const { t } = useTranslation();

  return (
    <Link to={`/propiedades?tipo=${type}`} className="category-card">
      <div className="category-card__image" style={{ backgroundImage: `url(${IMAGES[type]})` }} />
      <div className="category-card__overlay" />
      <div className="category-card__content">
        <span className="category-card__icon">
          <PropertyTypeIcon type={type} size={26} />
        </span>
        <h3>{t(`categories.${type}.title`)}</h3>
        <p>{t(`categories.${type}.desc`)}</p>
        <span className="category-card__count">{t("categories.properties", { count })}</span>
        <span className="btn btn-primary btn-sm category-card__cta">{t("categories.cta")}</span>
      </div>
    </Link>
  );
}
