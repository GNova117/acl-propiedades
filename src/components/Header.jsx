import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import { db } from "../lib/dataStore";
import "./Header.css";

// `typeKey`: si el tipo de propiedad correspondiente está desactivado
// (property_types.active) desde /admin/zonas, el enlace se oculta del menú
// en vez de llevar a un apartado sin nada — Inicio/Propiedades/Nosotros/
// Contacto no dependen de un tipo, siempre se muestran.
const NAV_ITEMS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/propiedades", key: "nav.properties" },
  { to: "/naves-industriales", key: "nav.industrial", typeKey: "nave_industrial" },
  { to: "/terrenos", key: "nav.land", typeKey: "terreno" },
  { to: "/nosotros", key: "nav.about" },
  { to: "/contacto", key: "nav.contact" },
];

export default function Header() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState([]);

  useEffect(() => {
    db.getPropertyTypes().then(setPropertyTypes).catch(() => setPropertyTypes([]));
  }, []);

  const isTypeActive = (key) => {
    const type = propertyTypes.find((pt) => pt.key === key);
    return !type || type.active !== false;
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.typeKey || isTypeActive(item.typeKey));

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <NavLink to="/" className="site-header__logo" onClick={() => setOpen(false)}>
          <Logo size="sm" />
        </NavLink>

        <nav className={`site-nav ${open ? "site-nav--open" : ""}`} aria-label="Navegación principal">
          <ul>
            {visibleNavItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>
                  {t(item.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <ThemeToggle />
          <LanguageToggle />
          <button
            type="button"
            className="site-header__burger"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
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
