import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import NavIcon from "./NavIcon";
import { NAV } from "../lib/adminNav";
import { ICON_BY_GROUP, ICON_BY_PATH } from "../lib/navIcons";
import { accessibleDestinations, searchDestinations } from "../lib/sectionSearch";
import "./AdminSectionSearch.css";

// Botón de la lupa en la barra superior (junto a notificaciones, tema e idioma): abre una ventana donde se escribe una
// palabra clave ("crédito", "gastos", "firma"…) y salen todas las pantallas del panel que tengan que ver. Complementa a la
// caja de búsqueda de datos (clientes, propiedades, teléfonos). Solo ofrece lo que el rol puede abrir.
export default function AdminSectionSearch() {
  const { t } = useTranslation();
  const { hasSection, advisorId } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const labelOf = (dest) => dest.label || t(dest.labelKey);
  const groupLabelOf = (dest) => (dest.groupKey ? t(`admin.groups.${dest.groupKey}`) : "");

  const destinations = useMemo(
    () => accessibleDestinations(NAV, hasSection, advisorId),
    [hasSection, advisorId]
  );
  // Sin dependencias de `t`: el idioma cambia con la ventana cerrada y la lista se recalcula al escribir.
  const results = useMemo(
    () => (open ? searchDestinations(destinations, query, labelOf, groupLabelOf) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, destinations, query, t]
  );

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
    buttonRef.current?.focus();
  };

  // Al cambiar de pantalla la ventana se cierra sola (sin devolver el foco: la nueva pantalla ya lo reclama).
  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    document.body.classList.add("admin-section-search-open");
    return () => document.body.classList.remove("admin-section-search-open");
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // La opción resaltada siempre queda a la vista al recorrer con las flechas.
  useEffect(() => {
    listRef.current?.querySelector(".is-active")?.scrollIntoView?.({ block: "nearest" });
  }, [active, results]);

  const go = (dest) => {
    setOpen(false);
    setQuery("");
    navigate(dest.to);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Tab") {
      // Foco dentro de la ventana mientras está abierta: el campo y el botón de cerrar.
      e.preventDefault();
      const target = document.activeElement === inputRef.current ? document.querySelector(".admin-section-search__close") : inputRef.current;
      target?.focus();
    }
  };

  const trimmed = query.trim();
  const optionId = (i) => `admin-section-search-opt-${i}`;

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className="icon-toggle admin-section-search__button"
        onClick={() => setOpen(true)}
        aria-label={t("sectionSearch.open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t("sectionSearch.open")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>
      {open && (
        <div className="admin-section-search__overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="admin-section-search__dialog" role="dialog" aria-modal="true" aria-label={t("sectionSearch.title")} onKeyDown={onKeyDown}>
            <div className="admin-section-search__head">
              <input
                ref={inputRef}
                type="search"
                className="admin-section-search__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("sectionSearch.placeholder")}
                aria-label={t("sectionSearch.title")}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="admin-section-search-list"
                aria-activedescendant={results.length ? optionId(active) : undefined}
                autoComplete="off"
                enterKeyHint="go"
              />
              <button type="button" className="admin-section-search__close" onClick={close} aria-label={t("sectionSearch.close")} title={t("sectionSearch.close")}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="admin-section-search__body" ref={listRef}>
              {trimmed === "" && <p className="admin-section-search__note">{t("sectionSearch.hint")}</p>}
              {trimmed !== "" && results.length === 0 && <p className="admin-section-search__note">{t("sectionSearch.noResults", { query: trimmed })}</p>}
              {results.length > 0 && (
                <>
                  <p className="admin-section-search__count" aria-live="polite">
                    {t("sectionSearch.count", { count: results.length })}
                  </p>
                  <ul className="admin-section-search__list" role="listbox" id="admin-section-search-list" aria-label={t("sectionSearch.title")}>
                    {results.map((dest, i) => (
                      <li
                        key={dest.to}
                        id={optionId(i)}
                        role="option"
                        aria-selected={i === active}
                        className={`admin-section-search__option${i === active ? " is-active" : ""}`}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(dest)}
                      >
                        <NavIcon name={ICON_BY_PATH[dest.to] || ICON_BY_GROUP[dest.groupKey] || "dashboard"} />
                        <span className="admin-section-search__label">{labelOf(dest)}</span>
                        {dest.groupKey && <span className="admin-section-search__group">{groupLabelOf(dest)}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
