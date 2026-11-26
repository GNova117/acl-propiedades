import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCompare } from "../context/CompareContext";
import "./CompareBar.css";

// Barra flotante «Comparar (N)» del listado: con 2 o más propiedades marcadas se puede ir a la comparación sin buscar el ícono del encabezado.
export default function CompareBar() {
  const { t } = useTranslation();
  const { compareIds, clearCompare } = useCompare();
  if (compareIds.length < 2) return null;
  return (
    <div className="compare-bar" role="region" aria-label={t("compare.title")}>
      <Link to="/comparar" className="btn btn-primary btn-sm">
        {t("compare.barCta", { count: compareIds.length })}
      </Link>
      <button type="button" className="btn btn-outline btn-sm" onClick={clearCompare}>
        {t("compare.clearAll")}
      </button>
    </div>
  );
}
