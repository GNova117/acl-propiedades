import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";
import PropertyCard from "../components/PropertyCard";
import { db } from "../lib/dataStore";
import "./NotFound.css";

const FEATURED_COUNT = 3;

// Una dirección que no existe no debe ser un callejón sin salida: se puede buscar y se ven propiedades destacadas.
export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    let active = true;
    db.getProperties({ activeOnly: true })
      .then((rows) => active && setFeatured(rows.filter((p) => p.status === "disponible").slice(0, FEATURED_COUNT)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/propiedades?q=${encodeURIComponent(q)}` : "/propiedades");
  };

  return (
    <div className="container">
      <Seo title="404" description={t("notFound.seoDescription")} noindex />
      <EmptyState illustration="signpost" title={`404 · ${t("notFound.title")}`} text={t("notFound.text")} as="h1" className="not-found">
        <form className="not-found__search" role="search" onSubmit={handleSearch}>
          <label htmlFor="not-found-q" className="visually-hidden">{t("notFound.searchLabel")}</label>
          <input id="not-found-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("notFound.searchPlaceholder")} />
          <button type="submit" className="btn btn-primary">{t("notFound.search")}</button>
        </form>
        <Link to="/" className="btn btn-primary">{t("notFound.home")}</Link>
        <Link to="/propiedades" className="btn btn-outline">{t("notFound.browse")}</Link>
      </EmptyState>

      {featured.length > 0 && (
        <section className="not-found__featured" aria-labelledby="not-found-featured">
          <h2 id="not-found-featured">{t("notFound.featured")}</h2>
          <div className="not-found__grid">
            {featured.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
