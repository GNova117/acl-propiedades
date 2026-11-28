import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Breadcrumbs.css";

// 297: migas de pan visibles (Inicio › Terrenos › Casa en…). Antes solo existían en los datos estructurados para Google; la
// lista que se muestra y la que se manda a Google salen del mismo arreglo, así que nunca se contradicen.
// `items` = [{ name, path }]: el último es la página actual (sin enlace, con aria-current="page").
export default function Breadcrumbs({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <nav className="breadcrumbs" aria-label={t("breadcrumbs.label")}>
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.path}>
              {last ? (
                <span aria-current="page">{item.name}</span>
              ) : (
                <Link to={item.path}>{item.name}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
