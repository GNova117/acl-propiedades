import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../lib/format";
import { dismissKey, loadDismissed, newMatches, saveDismissed } from "../lib/newMatches";
import { sendLink, suggestPropertyMessage } from "../lib/prospectMessages";
import "./MyDayPanels.css";
import { siteOrigin } from "../lib/site";

// «Propiedades nuevas para tus prospectos» (Mi día): propiedades publicadas esta semana que encajan con lo que busca
// un prospecto abierto. Avisar es decisión del asesor: «Avisarle» abre WhatsApp/correo con el mensaje armado y deja
// la pareja como atendida; «Ocultar» también. Lo atendido se recuerda en este dispositivo (por asesor).
export default function NewMatchesPanel({ prospects, properties, scope }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => loadDismissed(scope));
  const matches = useMemo(() => newMatches(prospects, properties, { dismissed }), [prospects, properties, dismissed]);

  const dismiss = (prospectId, propertyId) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(dismissKey(prospectId, propertyId));
      saveDismissed(scope, next);
      return next;
    });
  };

  if (matches.length === 0) return null;
  const total = matches.reduce((n, m) => n + m.properties.length, 0);

  return (
    <section className="card day-panel" aria-labelledby="new-matches-title">
      <h2 id="new-matches-title">
        {t("newMatches.title")} <span className="my-day__count">{total}</span>
      </h2>
      <p className="form-hint">{t("newMatches.hint")}</p>
      <ul className="day-panel__list day-panel__list--plain">
        {matches.slice(0, 8).map(({ prospect, properties: found }) => (
          <li key={prospect.id} className="day-panel__group">
            <Link to={`/admin/prospectos/${prospect.id}`} className="day-panel__who">
              {prospect.name}
            </Link>
            <ul className="day-panel__list day-panel__list--plain">
              {found.slice(0, 3).map((property) => {
                const link = sendLink(prospect, suggestPropertyMessage(prospect, property, `${siteOrigin()}/propiedades/${property.id}`), t("prospects.match.emailSubject"));
                return (
                  <li key={property.id} className="day-panel__match">
                    <a href={`/propiedades/${property.id}`} target="_blank" rel="noopener noreferrer">
                      {property.title}
                    </a>
                    <span className="form-hint">{[property.zone, formatMXN(property.price)].filter(Boolean).join(" · ")}</span>
                    {link && (
                      <a
                        className="btn btn-outline btn-sm"
                        href={link}
                        target={link.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        onClick={() => dismiss(prospect.id, property.id)}
                      >
                        {t("newMatches.notify")}
                      </a>
                    )}
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => dismiss(prospect.id, property.id)}>
                      {t("newMatches.hide")}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {matches.length > 8 && <p className="form-hint">{t("newMatches.more", { count: matches.length - 8 })}</p>}
    </section>
  );
}
