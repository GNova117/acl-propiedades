import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import FavoritesLink from "./FavoritesLink";
import CompareLink from "./CompareLink";
import { db } from "../lib/dataStore";
import { OFFICE } from "../lib/office.js";
import { useMediaQuery } from "../lib/useMediaQuery";
import "./Header.css";

// `typeKey`: si el tipo de propiedad correspondiente está desactivado
// (property_types.active) desde /admin/zonas, o está activo pero sin
// ninguna propiedad publicada, el enlace se oculta del menú en vez de
// llevar a un apartado sin nada — reaparece solo en cuanto se publica una.
// Inicio/Propiedades/Nosotros/Contacto no dependen de un tipo, siempre se
// muestran.
const NAV_ITEMS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/propiedades", key: "nav.properties" },
  { to: "/naves-industriales", key: "nav.industrial", typeKey: "nave_industrial" },
  { to: "/terrenos", key: "nav.land", typeKey: "terreno" },
  { to: "/vende-tu-casa", key: "nav.sellHome" },
  { to: "/blog", key: "nav.blog" },
  { to: "/nosotros", key: "nav.about" },
  { to: "/contacto", key: "nav.contact" },
  // 270: en teléfono el corazón de arriba pasa al menú con su nombre (en pantalla grande basta el ícono con su contador).
  { to: "/favoritos", key: "nav.favorites", mobileOnly: true },
];

const NAV_TYPE_KEYS = NAV_ITEMS.filter((item) => item.typeKey).map((item) => item.typeKey);

export default function Header() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // 318: en teléfono el encabezado solo lleva logotipo, favoritos y menú; tema e idioma viven dentro del menú.
  const narrow = useMediaQuery("(max-width: 860px)");
  const [propertyTypes, setPropertyTypes] = useState([]);
  // null = aún no llega (o falló): en ese caso no se oculta nada por
  // conteo, igual que isTypeActive con propertyTypes vacío.
  const [typeCounts, setTypeCounts] = useState(null);

  // Menú del teléfono abierto: Escape lo cierra y el fondo no se desplaza detrás.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    db.getPropertyTypes().then(setPropertyTypes).catch(() => setPropertyTypes([]));
    // Solo los conteos por tipo (antes bajaba todas las propiedades activas).
    db.getTypeCounts()
      .then((counts) => setTypeCounts(Object.fromEntries(NAV_TYPE_KEYS.map((key) => [key, counts[key] || 0]))))
      .catch(() => setTypeCounts(null));
  }, []);

  const isTypeActive = (key) => {
    const type = propertyTypes.find((pt) => pt.key === key);
    return !type || type.active !== false;
  };

  const hasListings = (key) => !typeCounts || typeCounts[key] > 0;

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => (!item.mobileOnly || narrow) && (!item.typeKey || (isTypeActive(item.typeKey) && hasListings(item.typeKey))),
  );

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <NavLink to="/" className="site-header__logo" onClick={() => setOpen(false)}>
          <Logo size="sm" />
        </NavLink>

        <nav className={`site-nav ${open ? "site-nav--open" : ""}`} aria-label={t("a11y.mainNav")}>
          <ul>
            {visibleNavItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>
                  {t(item.key)}
                </NavLink>
              </li>
            ))}
          </ul>
          {narrow && (
            <div className="site-nav__extras">
              <a className="btn btn-outline site-nav__call" href={`tel:${OFFICE.phoneTel}`}>
                {t("nav.call", { phone: OFFICE.phoneDisplay })}
              </a>
              <div className="site-nav__tools">
                <ThemeToggle />
                <LanguageToggle />
              </div>
            </div>
          )}
        </nav>

        <div className="site-header__actions">
          {/* 269: el teléfono de la oficina siempre a la vista en pantalla grande. */}
          {!narrow && (
            <a className="site-header__phone" href={`tel:${OFFICE.phoneTel}`}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>{OFFICE.phoneDisplay}</span>
            </a>
          )}
          <CompareLink />
          <FavoritesLink />
          {!narrow && (
            <>
              <ThemeToggle />
              <LanguageToggle />
            </>
          )}
          <button
            type="button"
            className="site-header__burger"
            onClick={() => setOpen((v) => !v)}
            aria-label={t(open ? "a11y.closeMenu" : "a11y.openMenu")}
            aria-expanded={open}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
