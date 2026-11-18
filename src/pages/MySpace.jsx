import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { useFavorites } from "../context/FavoritesContext";
import { clearItems, forgetItem, getItems, groupItems, itemPath } from "../lib/mySpace";
import "./MySpace.css";
import { confirmDialog } from "../lib/toast";
import EmptyState from "../components/EmptyState";

// /mi-espacio: lo del cliente en un solo lugar (ver src/lib/mySpace.js). Lee del dispositivo; no pide nada
// al servidor hasta que la persona toca un enlace.
export default function MySpace() {
  const { t, i18n } = useTranslation();
  const { favorites } = useFavorites();
  const [items, setItems] = useState(() => getItems());
  const groups = groupItems(items);
  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";

  const forget = (item) => {
    forgetItem(item.kind, item.token);
    setItems(getItems());
  };
  const forgetAll = async () => {
    if (!await confirmDialog(t("mySpace.forgetAllConfirm"))) return;
    clearItems();
    setItems([]);
  };

  return (
    <>
      <Seo title={t("mySpace.title")} description={t("mySpace.subtitle")} noindex />
      <div className="container my-space">
        <div className="section-heading m-section">
          <h2>{t("mySpace.title")}</h2>
          <p>{t("mySpace.subtitle")}</p>
        </div>

        <section className="card my-space__block" aria-labelledby="my-space-fav">
          <h3 id="my-space-fav">{t("mySpace.favorites")}</h3>
          <p>{t("mySpace.favoritesCount", { count: favorites.length })}</p>
          <Link to="/favoritos" className="btn btn-outline btn-sm">
            {t("mySpace.openFavorites")}
          </Link>
        </section>

        {groups.map((group) => (
          <section className="card my-space__block" key={group.kind} aria-labelledby={`my-space-${group.kind}`}>
            <h3 id={`my-space-${group.kind}`}>{t(`mySpace.kinds.${group.kind}`)}</h3>
            <ul className="my-space__list">
              {group.items.map((item) => (
                <li key={`${item.kind}-${item.token}`}>
                  <div>
                    <Link to={itemPath(item)} className="my-space__link">
                      {item.title || t(`mySpace.defaultTitle.${item.kind}`)}
                    </Link>
                    {item.detail && <span className="my-space__detail">{item.detail}</span>}
                    <span className="form-hint">{t("mySpace.openedOn", { date: new Date(item.at).toLocaleDateString(locale, { day: "numeric", month: "short" }) })}</span>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => forget(item)} aria-label={t("mySpace.forgetOne", { title: item.title || t(`mySpace.defaultTitle.${item.kind}`) })}>
                    {t("mySpace.forget")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {groups.length === 0 && (
          <EmptyState illustration="heart" title={t("emptyState.mySpaceTitle")} text={t("mySpace.empty")}>
            <Link to="/propiedades" className="btn btn-primary">
              {t("favorites.browseCta")}
            </Link>
          </EmptyState>
        )}

        <p className="form-hint my-space__privacy">{t("mySpace.privacy")}</p>
        {items.length > 0 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={forgetAll}>
            {t("mySpace.forgetAll")}
          </button>
        )}
      </div>
    </>
  );
}
