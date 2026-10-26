import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PropertyCard from "./PropertyCard";
import Reveal from "./Reveal";
import { pickFeaturedProperties } from "../lib/propertyBadges";
import "./FeaturedProperties.css";

// Sección "Propiedades destacadas" del inicio: las que bajaron de precio y las
// más recientes. Sin propiedades disponibles no se pinta (ni su espacio).
export default function FeaturedProperties({ properties }) {
  const { t } = useTranslation();
  const picked = pickFeaturedProperties(properties);
  // La cuadrícula es de 3 columnas: se recorta a filas completas (3 o 6) para
  // que no quede una tarjeta huérfana en la última fila.
  const featured = picked.length >= 3 ? picked.slice(0, picked.length - (picked.length % 3)) : picked;
  if (featured.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-heading">
          <span className="section-heading__eyebrow">{t("featured.eyebrow")}</span>
          <h2>{t("featured.title")}</h2>
          <p className="featured-properties__subtitle">{t("featured.subtitle")}</p>
        </Reveal>
        <div className="featured-properties__grid">
          {featured.map((property, index) => (
            <Reveal key={property.id} delay={(index % 3) * 80}>
              <PropertyCard property={property} />
            </Reveal>
          ))}
        </div>
        <div className="featured-properties__more">
          <Link to="/propiedades" className="btn btn-outline">{t("featured.cta")}</Link>
        </div>
      </div>
    </section>
  );
}
