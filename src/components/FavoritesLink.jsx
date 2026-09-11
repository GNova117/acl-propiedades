import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFavorites } from "../context/FavoritesContext";
import "./FavoritesLink.css";

export default function FavoritesLink() {
  const { t } = useTranslation();
  const { favorites } = useFavorites();

  return (
    <Link to="/favoritos" className="icon-toggle favorites-link" aria-label={t("favorites.title")} title={t("favorites.title")}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={favorites.length > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {favorites.length > 0 && <span className="favorites-link__count">{favorites.length}</span>}
    </Link>
  );
}
