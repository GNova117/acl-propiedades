import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { OWNER_STATUSES, buildOwnerMessage, whatsappDraftUrl } from "../lib/ownerMessage";
import { propertyPath } from "../lib/propertyUrl.js";
import { siteOrigin } from "../lib/site";
import "./PropertyProspectsModal.css";
import "./SaleDataModal.css";

// 460: «Avisar al dueño»: mensaje de partida (editable) según el estatus de la propiedad, para copiarlo o abrirlo en WhatsApp.
export default function OwnerMessageModal({ property, onClose }) {
  const { t } = useTranslation();
  const initial = OWNER_STATUSES.includes(property.status) ? property.status : "disponible";
  const [status, setStatus] = useState(initial);
  const url = `${siteOrigin()}${propertyPath(property)}`;
  const [text, setText] = useState(() => buildOwnerMessage(t, property, initial, url));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changeStatus = (e) => {
    setStatus(e.target.value);
    setText(buildOwnerMessage(t, property, e.target.value, url));
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Sin portapapeles: el texto sigue a la vista para copiarlo a mano.
    }
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-labelledby="owner-message-title">
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card">
        <div className="match-modal__head">
          <h2 id="owner-message-title">{t("ownerMessage.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="form-hint">{t("ownerMessage.intro", { title: property.title })}</p>
        <div className="form-field">
          <label htmlFor="owner-message-status">{t("ownerMessage.statusLabel")}</label>
          <select id="owner-message-status" value={status} onChange={changeStatus}>
            {OWNER_STATUSES.map((key) => (
              <option key={key} value={key}>
                {t(`propertyStatus.${key}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="owner-message-text">{t("ownerMessage.textLabel")}</label>
          <textarea id="owner-message-text" rows={7} value={text} onChange={(e) => { setText(e.target.value); setCopied(false); }} />
        </div>
        <div className="sale-data__actions">
          <button type="button" className="btn btn-primary" onClick={copy}>
            {copied ? t("ownerMessage.copied") : t("ownerMessage.copy")}
          </button>
          <a className="btn btn-outline" href={whatsappDraftUrl(text)} target="_blank" rel="noopener noreferrer">
            {t("ownerMessage.whatsapp")}
          </a>
        </div>
        <p className="form-hint" role="status">{copied ? t("ownerMessage.copiedHint") : ""}</p>
      </div>
    </div>
  );
}
