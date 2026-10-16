import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { criteriaSummary } from "../lib/prospectMatch";
import { sendLink, suggestPropertyMessage } from "../lib/prospectMessages";
import "./PropertyProspectsModal.css";

// "Prospectos que encajan" con una propiedad (Propiedades del admin): lista los
// prospectos abiertos cuyo "qué busca" coincide, con un botón para mandarles la
// propiedad por WhatsApp (o correo si no tienen teléfono). `prospects` ya viene
// filtrado y ordenado (prospectMatch.matchingProspects).
export default function PropertyProspectsModal({ property, prospects, onClose }) {
  const { t } = useTranslation();
  const url = `${window.location.origin}/propiedades/${property.id}`;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("prospects.match.modalTitle")}>
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card">
        <div className="match-modal__head">
          <h2>{t("prospects.match.modalTitle")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="form-hint">{t("prospects.match.modalHint", { title: property.title })}</p>

        <ul className="match-modal__list">
          {prospects.map((p) => {
            const link = sendLink(p, suggestPropertyMessage(p, property, url), t("prospects.match.emailSubject"));
            return (
              <li key={p.id} className="match-modal__item">
                <div className="match-modal__info">
                  <strong>{p.name}</strong> <span className="prospect-chip">{t(`prospects.stages.${p.stage}`)}</span>
                  <p className="form-hint">{criteriaSummary(p.search_criteria, t)}</p>
                </div>
                <div className="match-modal__actions">
                  {link ? (
                    <a className="btn btn-primary btn-sm" href={link} target={link.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                      {t("prospects.match.send")}
                    </a>
                  ) : (
                    <span className="form-hint">{t("prospects.match.noContact")}</span>
                  )}
                  <Link to={`/admin/prospectos/${p.id}`} className="btn btn-outline btn-sm">
                    {t("prospects.match.openProspect")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
