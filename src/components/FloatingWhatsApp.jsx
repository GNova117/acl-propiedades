import { useTranslation } from "react-i18next";
import WhatsAppIcon from "./icons/WhatsAppIcon";
import { OFFICE_WHATSAPP } from "../lib/office";
import "./FloatingWhatsApp.css";

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
