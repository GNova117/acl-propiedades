import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PropertyTypeIcon from "./PropertyTypeIcon";
import { propertyListPath } from "../lib/format";
import { unsplashSrcSet } from "../lib/imageSizes";
import "./CategoryCard.css";

const IMAGES = {
  casa: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80",
  departamento: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80",
  nave_industrial: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=900&q=80",
  terreno: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80",
};

// `active`/`imageUrl` vienen del tipo de propiedad correspondiente
// (property_types, administrable desde /admin/zonas). Un tipo inactivo se
// muestra igual (no desaparece del todo) pero como "Próximamente" — sin
// enlace, sin contador — para no anunciar un apartado que hoy no tiene
// nada que mostrar.
export default function CategoryCard({ type, count, active = true, imageUrl }) {
  const { t } = useTranslation();
  const path = type === "casa" || type === "departamento" ? `/propiedades?tipo=${type}` : propertyListPath(type);
  const image = imageUrl || IMAGES[type];

  const content = (
    <>
      {/* 222: <img> con carga diferida y varios anchos (antes un background-image de 900 px que siempre se bajaba completo). */}
      <img
        className="category-card__image"
        src={image}
        srcSet={unsplashSrcSet(image) || undefined}
        sizes="(max-width: 980px) 100vw, 33vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
      <div className="category-card__overlay" />
      <div className="category-card__content">
        <span className="category-card__icon">
          <PropertyTypeIcon type={type} size={26} />
        </span>
        <h3>{t(`categories.${type}.title`)}</h3>
        {active ? (
          <>
            <p>{t(`categories.${type}.desc`)}</p>
            {/* Mientras llegan los conteos (count = null) no se escribe «0 propiedades». */}
            {count != null && <span className="category-card__count">{t("categories.properties", { count })}</span>}
            <span className="btn btn-primary btn-sm category-card__cta">{t("categories.cta")}</span>
          </>
        ) : (
          <span className="category-card__badge">{t("categories.comingSoon")}</span>
        )}
      </div>
    </>
  );

  if (!active) {
    return <div className="category-card category-card--disabled">{content}</div>;
  }

  return (
    <Link to={path} className="category-card">
      {content}
    </Link>
  );
}
