import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import PropertyCard from "../components/PropertyCard";
import { useFavorites } from "../context/FavoritesContext";
import { db } from "../lib/dataStore";
import "./Properties.css";

export default function Favorites() {
  const { t } = useTranslation();
  const { favorites } = useFavorites();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Cada favorito se busca por su cuenta (no hay un filtro "ids" en
    // getProperties) — una lista de favoritos nunca es tan grande como
    // para que esto pese; una propiedad borrada después de guardarla
    // simplemente no aparece (catch -> null -> filtrada).
    Promise.all(favorites.map((id) => db.getPropertyById(id).catch(() => null))).then((results) => {
      if (active) {
        setProperties(results.filter(Boolean));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [favorites]);

  return (
    <>
      <Seo title={t("favorites.title")} description={t("favorites.subtitle")} />

      <div className="container properties-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h2>{t("favorites.title")}</h2>
          <p>{t("favorites.subtitle")}</p>
        </div>

        {loading ? (
          <div className="empty-state">{t("common.loading")}</div>
        ) : properties.length === 0 ? (
          <div className="empty-state">
            <p>{t("favorites.empty")}</p>
            <Link to="/propiedades" className="btn btn-primary">
              {t("favorites.browseCta")}
            </Link>
          </div>
        ) : (
          <div className="properties-grid">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
