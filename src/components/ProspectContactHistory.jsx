import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import "./ProspectContactHistory.css";

// Historial de contactos de un prospecto (el que se arma con "Registrar
// contacto" en la lista de Prospectos): más reciente primero, solo lectura.
export default function ProspectContactHistory({ prospectId }) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    db.getProspectContacts(prospectId)
      .then((rows) => !cancelled && setContacts(rows))
      .catch((err) => !cancelled && setError(err.message || "Error"));
    return () => {
      cancelled = true;
    };
  }, [prospectId]);

  return (
    <section className="card contact-history" aria-label={t("prospects.contact.historyTitle")}>
      <h2 className="contact-history__title">{t("prospects.contact.historyTitle")}</h2>
      {error && <p className="form-error">{error}</p>}
      {contacts === null && !error && <p className="form-hint">…</p>}
      {contacts?.length === 0 && <p className="form-hint">{t("prospects.contact.historyEmpty")}</p>}
      {contacts?.length > 0 && (
        <ul className="contact-history__list">
          {contacts.map((c) => (
            <li key={c.id} className="contact-history__item">
              <span className="contact-history__when">
                {new Date(c.at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="prospect-chip">{t(`prospects.contact.channels.${c.channel}`, { defaultValue: c.channel })}</span>
              {c.note && <span className="contact-history__note">{c.note}</span>}
              {c.actor && <span className="contact-history__actor form-hint">{c.actor}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
