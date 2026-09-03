import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import "./Header.css";

const NAV_ITEMS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/propiedades", key: "nav.properties" },
  { to: "/naves-industriales", key: "nav.industrial" },
  { to: "/terrenos", key: "nav.land" },
  { to: "/nosotros", key: "nav.about" },
  { to: "/contacto", key: "nav.contact" },
];

export default function Header() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <NavLink to="/" className="site-header__logo" onClick={() => setOpen(false)}>
          <Logo size="sm" />
        </NavLink>

        <nav className={`site-nav ${open ? "site-nav--open" : ""}`} aria-label="Navegación principal">
          <ul>
            {NAV_ITEMS.map((item) => (
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
