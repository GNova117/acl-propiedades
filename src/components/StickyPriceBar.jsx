import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../lib/format";
import { OFFICE_WHATSAPP } from "../lib/office";
import { OPEN_SCHEDULE_EVENT, SCHEDULE_TARGET_ID } from "./MobileContactBar";
import "./StickyPriceBar.css";
import { propertyPath } from "../lib/propertyUrl.js";

// Barra con el precio y los botones de contacto que aparece BAJO el encabezado del sitio cuando el bloque del precio de la
// ficha ya salió de la pantalla (solo en computadora: en el teléfono está la barra de abajo, MobileContactBar). Así el
// precio y «Agendar visita» no se pierden al bajar por una ficha larga. `anchorSelector`: el bloque cuya visibilidad
// decide si la barra aparece.
export default function StickyPriceBar({ property, anchorSelector = ".property-detail__price-block" }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [top, setTop] = useState(0);

  useEffect(() => {
    const anchor = document.querySelector(anchorSelector);
    if (!anchor || typeof IntersectionObserver === "undefined") return undefined;
    const header = document.querySelector(".site-header");
    const measure = () => setTop(header ? header.getBoundingClientRect().height : 0);
    measure();
    window.addEventListener("resize", measure);
    // La barra sale cuando el precio de arriba deja de verse POR ARRIBA (se bajó); no si todavía no se ha llegado a él.
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { rootMargin: `-${header ? header.getBoundingClientRect().height : 0}px 0px 0px 0px` });
    observer.observe(anchor);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [anchorSelector, property.id]);

  const label = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
  const text = `${t("mobileBar.whatsappText", { property: label })}\n${window.location.origin}${propertyPath(property)}`;
  const whatsappUrl = `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(text)}`;
  const schedule = () => {
    window.dispatchEvent(new Event(OPEN_SCHEDULE_EVENT));
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(SCHEDULE_TARGET_ID)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  };

  return (
    <div className={`sticky-price-bar${visible ? " is-visible" : ""}`} style={{ top }} role="region" aria-label={t("stickyBar.label")} aria-hidden={!visible}>
      <div className="container sticky-price-bar__inner">
        <div className="sticky-price-bar__info">
          <strong className="sticky-price-bar__price">{formatMXN(property.price)}</strong>
          <span className="sticky-price-bar__title">{property.title}</span>
        </div>
        <div className="sticky-price-bar__actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={schedule} tabIndex={visible ? 0 : -1}>
            {t("mobileBar.schedule")}
          </button>
          <a className="btn btn-outline btn-sm" href={whatsappUrl} target="_blank" rel="noopener noreferrer" tabIndex={visible ? 0 : -1}>
            {t("mobileBar.whatsapp")}
          </a>
        </div>
      </div>
    </div>
  );
}
