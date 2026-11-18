import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFavorites } from "../context/FavoritesContext";
import "./PublicTabBar.css";

// Barra inferior del sitio público en el teléfono: las tres cosas que más se buscan, al alcance del pulgar. En la ficha de
// una propiedad no va: ahí ya hay su propia barra (agendar visita / WhatsApp) y las dos juntas taparían la página.
const ICONS = {
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.5-4.5",
  heart: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  chat: "M21 12a8 8 0 01-11.5 7.2L3 21l1.8-5.5A8 8 0 1121 12z",
};

const TABS = [
  { to: "/propiedades", icon: "search", key: "search", end: false },
  { to: "/favoritos", icon: "heart", key: "favorites", end: true },
  { to: "/contacto", icon: "chat", key: "contact", end: true },
];

export const isPropertyDetailPath = (pathname) => /^\/propiedades\/(?!zona\/)[^/]+\/?$/.test(pathname);

export default function PublicTabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { favorites } = useFavorites();
  const visible = !isPropertyDetailPath(pathname);

  // Deja lugar a la barra: el pie de página y el botón del chat suben (ver PublicTabBar.css).
  useEffect(() => {
    document.body.classList.toggle("has-tab-bar", visible);
    return () => document.body.classList.remove("has-tab-bar");
  }, [visible]);

  if (!visible) return null;
  return (
    <nav className="public-tab-bar" aria-label={t("tabBar.label")}>
      {TABS.map(({ to, icon, key, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `public-tab-bar__tab${isActive ? " is-active" : ""}`}>
          <span className="public-tab-bar__icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill={key === "favorites" && favorites.length > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d={ICONS[icon]} />
            </svg>
            {key === "favorites" && favorites.length > 0 && <span className="public-tab-bar__count" aria-label={t("tabBar.favoritesCount", { count: favorites.length })}>{favorites.length}</span>}
          </span>
          <span>{t(`tabBar.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
