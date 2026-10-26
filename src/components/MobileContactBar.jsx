import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { OFFICE_WHATSAPP } from "../lib/office";
import "./MobileContactBar.css";

export const OPEN_SCHEDULE_EVENT = "acl:open-schedule-visit";
export const SCHEDULE_TARGET_ID = "agendar-visita";

// Barra fija al pie de la ficha de propiedad en pantallas angostas, donde
// "Agendar visita" queda hasta el final de la página. "Agendar visita" baja
// hasta la tarjeta y la abre; "WhatsApp" abre el chat de la oficina con la
// propiedad ya mencionada (los datos del asesor no se publican en la ficha).
export default function MobileContactBar({ property }) {
  const { t } = useTranslation();

  // El botón flotante del chatbot ocupa la misma esquina: mientras la barra
  // está en pantalla se sube (ver MobileContactBar.css).
  useEffect(() => {
    document.body.classList.add("has-mobile-bar");
    return () => document.body.classList.remove("has-mobile-bar");
  }, []);

  const label = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
  const text = `${t("mobileBar.whatsappText", { property: label })}\n${window.location.origin}/propiedades/${property.id}`;
  const whatsappUrl = `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(text)}`;

  const handleSchedule = () => {
    window.dispatchEvent(new Event(OPEN_SCHEDULE_EVENT));
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(SCHEDULE_TARGET_ID)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="mobile-contact-bar" role="region" aria-label={t("mobileBar.schedule")}>
      <button type="button" className="btn btn-primary mobile-contact-bar__schedule" onClick={handleSchedule}>
        {t("mobileBar.schedule")}
      </button>
      <a className="btn btn-outline mobile-contact-bar__whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        {t("mobileBar.whatsapp")}
      </a>
    </div>
  );
}
