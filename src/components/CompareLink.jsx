import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCompare } from "../context/CompareContext";
import "./CompareLink.css";

// A diferencia de FavoritesLink (siempre visible), este ícono solo
// aparece en el header cuando hay algo que comparar — comparar es una
// selección corta y ocasional, no vale la pena un quinto ícono permanente
// junto a favoritos/tema/idioma/menú para algo que la mayoría de las
// visitas nunca usa.
export default function CompareLink() {
  const { t } = useTranslation();
  const { compareIds } = useCompare();

  if (compareIds.length === 0) return null;

  return (
    <Link to="/comparar" className="icon-toggle compare-link" aria-label={t("compare.title")} title={t("compare.title")}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3v18M9 3L5 7M9 3l4 4" />
        <path d="M15 21V3M15 21l-4-4M15 21l4-4" />
      </svg>
      <span className="compare-link__count">{compareIds.length}</span>
    </Link>
  );
}
