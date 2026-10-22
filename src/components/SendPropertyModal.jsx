import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { whatsappDigits, whatsappUrl } from "../lib/format";
import { propertyShareMessage } from "../lib/propertyShare";
import { contactFields } from "../lib/prospects";
import ProspectContactForm from "./ProspectContactForm";
import "./PropertyProspectsModal.css";
import "./SendPropertyModal.css";

const MAX_LISTED = 6;
const OTHER = "other";

const normalize = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// "Enviar" de una propiedad (Propiedades del admin): el asesor elige a un
// prospecto (o escribe un número) y se abre WhatsApp con el mensaje de la
// propiedad ya escrito — título, zona, precio, datos y enlace (WhatsApp arma la
// vista previa con la foto). Si fue a un prospecto, enseguida se ofrece
// registrar el contacto (mismo formulario que en Prospectos, que pide el
// siguiente seguimiento). `prospects`: prospectos abiertos; `onLogged`: recibe el
// prospecto ya actualizado para que la pantalla de fondo no quede desfasada.
export default function SendPropertyModal({ property, prospects, onClose, onLogged }) {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [phone, setPhone] = useState("");
  const [advisorName, setAdvisorName] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState("");
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!advisorId) return undefined;
    let cancelled = false;
    db.getAdvisors()
      .then((list) => !cancelled && setAdvisorName(list.find((a) => a.id === advisorId)?.name || ""))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [advisorId]);

  const prospect = prospects.find((p) => p.id === selectedId) || null;
  const recipientName = prospect?.name || "";
  const origin = window.location.origin;

  // El mensaje se vuelve a armar al cambiar de destinatario (saluda por su nombre)
  // o cuando llega el nombre del asesor; lo que el asesor edite se respeta hasta
  // entonces. Depende del nombre y no del objeto del prospecto: al registrar el
  // contacto la lista se actualiza, y eso no debe borrar el mensaje ni el aviso.
  useEffect(() => {
    setText(propertyShareMessage(property, { origin, recipientName, advisorName }));
    setSent(false);
    setLogged(false);
  }, [property, origin, selectedId, recipientName, advisorName]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    const list = q ? prospects.filter((p) => [p.name, p.phone].some((v) => normalize(v).includes(q))) : prospects;
    return list.slice(0, MAX_LISTED);
  }, [prospects, query]);

  const targetPhone = selectedId === OTHER ? phone : prospect?.phone;
  const link = whatsappDigits(targetPhone).length >= 10 ? whatsappUrl(targetPhone, text) : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        window.prompt(t("detail.copyLinkManual"), text);
      } catch {
        // Sin portapapeles ni prompt: el texto sigue a la vista en el cuadro.
      }
    }
  };

  const saveContact = async ({ channel, note, nextFollowup }) => {
    setLogging(true);
    setLogError("");
    try {
      const updated = await db.logProspectContact(prospect.id, contactFields(prospect, nextFollowup), { channel, note });
      onLogged?.(updated);
      setLogged(true);
    } catch (err) {
      setLogError(err.message || t("prospects.saveError"));
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("sendProperty.title")}>
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card">
        <div className="match-modal__head">
          <h2>{t("sendProperty.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="form-hint">
          <strong>{property.title}</strong> — {t("sendProperty.hint")}
        </p>

        <fieldset className="send-property__group">
          <legend>{t("sendProperty.prospects")}</legend>
          {prospects.length > 0 && (
            <div className="form-field">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("sendProperty.search")}
                aria-label={t("sendProperty.search")}
              />
            </div>
          )}
          <div className="send-property__options" role="radiogroup" aria-label={t("sendProperty.prospects")}>
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selectedId === p.id}
                className={`send-property__option${selectedId === p.id ? " is-active" : ""}`}
                onClick={() => setSelectedId(p.id)}
              >
                <strong>{p.name}</strong>
                <span className="form-hint">{p.phone || t("sendProperty.noPhone")}</span>
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={selectedId === OTHER}
              className={`send-property__option${selectedId === OTHER ? " is-active" : ""}`}
              onClick={() => setSelectedId(OTHER)}
            >
              <strong>{t("sendProperty.otherNumber")}</strong>
            </button>
          </div>
          {filtered.length === 0 && prospects.length > 0 && <p className="form-hint">{t("sendProperty.noProspects")}</p>}
          {selectedId === OTHER && (
            <div className="form-field">
              <label htmlFor="send-property-phone">{t("sendProperty.phone")}</label>
              <input id="send-property-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
            </div>
          )}
        </fieldset>

        <div className="form-field">
          <label htmlFor="send-property-text">{t("sendProperty.message")}</label>
          <textarea id="send-property-text" rows={9} value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        <div className="send-property__actions">
          {link ? (
            <a className="btn btn-primary" href={link} target="_blank" rel="noopener noreferrer" onClick={() => setSent(true)}>
              {t("sendProperty.openWhatsApp")}
            </a>
          ) : (
            <span className="form-hint">{t("sendProperty.needRecipient")}</span>
          )}
          <button type="button" className="btn btn-outline" onClick={handleCopy}>
            {copied ? t("sendProperty.copied") : t("sendProperty.copy")}
          </button>
        </div>

        {sent && prospect && (
          <div className="send-property__log">
            {logged ? (
              <p className="form-hint">{t("sendProperty.logged")}</p>
            ) : (
              <>
                <p className="form-hint">{t("sendProperty.logTitle", { name: prospect.name })}</p>
                <ProspectContactForm
                  key={`${prospect.id}-whatsapp`}
                  prospect={prospect}
                  defaultChannel="whatsapp"
                  saving={logging}
                  error={logError}
                  onSave={saveContact}
                  onCancel={() => setSent(false)}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
