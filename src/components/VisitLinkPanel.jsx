import { useTranslation } from "react-i18next";
import { whatsappDigits } from "../lib/format";
import CopyVisitLinkButton from "./CopyVisitLinkButton";

// Enlace de una cita para mandárselo al cliente (confirmar asistencia, cambiar el horario o cancelar):
// botón de WhatsApp —con el mensaje ya escrito— si hay teléfono, y "Copiar enlace" para cualquier otro medio.
export default function VisitLinkPanel({ link, phone, text }) {
  const { t } = useTranslation();
  let digits = whatsappDigits(phone);
  if (digits.length === 10) digits = `52${digits}`;
  return (
    <div className="visit-link-panel">
      <h3 className="visit-link-panel__title">{t("visitLink.panelTitle")}</h3>
      <p className="form-hint">{t("visitLink.panelHint")}</p>
      <div className="visit-link-panel__actions">
        {digits && (
          <a className="btn btn-primary btn-sm" href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            {t("visitLink.send")}
          </a>
        )}
        <CopyVisitLinkButton link={link} />
      </div>
      {!digits && <p className="form-hint">{t("visitLink.noPhone")}</p>}
    </div>
  );
}
