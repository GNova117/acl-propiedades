import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import PropertyCard from "../components/PropertyCard";
import ShareButton from "../components/ShareButton";
import { useFavorites } from "../context/FavoritesContext";
import { db } from "../lib/dataStore";
import { buildFavoritesShareUrl, parseSharedIds } from "../lib/favoritesShare";
import "./Properties.css";
import "./Favorites.css";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";

export default function Favorites() {
  const { t } = useTranslation();
  const { search } = useLocation();
  const { favorites, addFavorites } = useFavorites();
  // /favoritos?lista=… : la lista que alguien compartió (se ve sin tocar los favoritos propios).
  const sharedIds = useMemo(() => parseSharedIds(search), [search]);
  const shared = sharedIds.length > 0;
  const ids = shared ? sharedIds : favorites;
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Cada favorito se busca por su cuenta (no hay un filtro "ids" en
    // getProperties) — una lista de favoritos nunca es tan grande como
    // para que esto pese; una propiedad borrada después de guardarla
    // simplemente no aparece (catch -> null -> filtrada).
    Promise.all(ids.map((id) => db.getPropertyById(id).catch(() => null))).then((results) => {
      if (active) {
        setProperties(results.filter(Boolean));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // `ids` cambia de identidad en cada render cuando es la lista compartida; su contenido es lo que cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  useEffect(() => setSaved(false), [search]);

  const shareUrl = typeof window !== "undefined" ? buildFavoritesShareUrl(window.location.origin, favorites) : "";
  const shareText = `${t("favoritesShare.shareText")}\n${shareUrl}`;
  const allSaved = shared && properties.length > 0 && properties.every((p) => favorites.includes(p.id));

  return (
    <>
      <Seo title={shared ? t("favoritesShare.sharedTitle") : t("favorites.title")} description={t("favorites.subtitle")} />

      <div className="container properties-page">
        <div className="section-heading m-section">
          <h2>{shared ? t("favoritesShare.sharedTitle") : t("favorites.title")}</h2>
          <p>{shared ? t("favoritesShare.sharedSubtitle") : t("favorites.subtitle")}</p>
        </div>

        {shared && !loading && properties.length > 0 && (
          <div className="card favorites-banner" role="status">
            <p>{t("favoritesShare.sharedBanner", { count: properties.length })}</p>
            <div className="favorites-banner__actions">
              {allSaved || saved ? (
                <strong>{t("favoritesShare.saved")}</strong>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    addFavorites(properties.map((p) => p.id));
                    setSaved(true);
                  }}
                >
                  {t("favoritesShare.saveAll")}
                </button>
              )}
              <Link to="/favoritos" className="btn btn-outline btn-sm">
                {t("favoritesShare.viewMine")}
              </Link>
            </div>
          </div>
        )}

        {!shared && !loading && properties.length > 0 && (
          <div className="favorites-share">
            <ShareButton title={t("favoritesShare.shareText")} text={shareText} url={shareUrl} />
            <span className="form-hint">{t("favoritesShare.shareHint")}</span>
          </div>
        )}

        {loading ? (
          <LoadingState variant="cards" />
        ) : properties.length === 0 ? (
          <EmptyState illustration="heart" title={t("emptyState.favoritesTitle")} text={shared ? t("favoritesShare.sharedEmpty") : t("favorites.empty")}>
            <Link to="/propiedades" className="btn btn-primary">
              {t("favorites.browseCta")}
            </Link>
          </EmptyState>
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
