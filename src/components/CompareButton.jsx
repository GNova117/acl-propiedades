import { useTranslation } from "react-i18next";
import { useCompare, MAX_COMPARE } from "../context/CompareContext";
import "./CompareButton.css";

// Mismo esquema que FavoriteButton: flota sobre la foto en PropertyCard,
// o se usa en línea (className="compare-button--inline") en la ficha.
export default function CompareButton({ propertyId, className = "" }) {
  const { t } = useTranslation();
  const { isComparing, toggleCompare, isCompareFull } = useCompare();
  const active = isComparing(propertyId);
  const disabled = !active && isCompareFull;

  const handleClick = (e) => {
    // Igual que FavoriteButton: este botón vive dentro de un <Link> en la
    // tarjeta, así que hay que frenar la navegación al hacer clic.
    e.preventDefault();
    e.stopPropagation();
    const added = toggleCompare(propertyId);
    if (!added) window.alert(t("compare.full", { max: MAX_COMPARE }));
  };

  const label = active ? t("compare.remove") : disabled ? t("compare.full", { max: MAX_COMPARE }) : t("compare.add");

  return (
    <button
      type="button"
      className={`compare-button ${active ? "compare-button--active" : ""} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {active ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
          <path d="M8 12.5l2.7 2.7L16.5 9" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        </svg>
      )}
    </button>
  );
}
