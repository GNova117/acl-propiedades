import { useTranslation } from "react-i18next";
import WhatsAppIcon from "./icons/WhatsAppIcon";
import "./FloatingWhatsApp.css";

// Mismo número de WhatsApp que ya se usa en el footer para contacto público
// (871 324 3271 — distinto del número dedicado de WhatsApp Business que
// manda los avisos automáticos de Agenda/mensajes de contacto).
const OFFICE_WHATSAPP = "528713243271";
const DEFAULT_MESSAGE = "Hola, quiero más información.";

export default function FloatingWhatsApp() {
  const { t } = useTranslation();
  const href = `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a href={href} target="_blank" rel="noreferrer" className="floating-whatsapp" aria-label={t("detail.whatsapp")} title={t("detail.whatsapp")}>
      <WhatsAppIcon size={28} />
    </a>
  );
}
