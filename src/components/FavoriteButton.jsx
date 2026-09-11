import { useTranslation } from "react-i18next";
import { useFavorites } from "../context/FavoritesContext";
import "./FavoriteButton.css";

// Se usa tanto flotando sobre la imagen de PropertyCard como en línea en
// la ficha de propiedad — el posicionamiento (absoluto vs. en línea) lo
// define el className que pasa cada quien lo use, no este componente.
export default function FavoriteButton({ propertyId, className = "" }) {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(propertyId);

  const handleClick = (e) => {
    // PropertyCard pone este botón dentro de un <Link> — sin esto, el
    // clic también navegaría a la ficha de la propiedad.
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(propertyId);
  };

  return (
    <button
      type="button"
      className={`favorite-button ${active ? "favorite-button--active" : ""} ${className}`}
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? t("favorites.remove") : t("favorites.add")}
      title={active ? t("favorites.remove") : t("favorites.add")}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
