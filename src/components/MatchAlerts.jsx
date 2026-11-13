import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMXN, whatsappUrl } from "../lib/format";
import { prospectKey } from "../lib/matchAlerts";
import { criteriaSummary } from "../lib/prospectMatch";
import { propertyShareMessage } from "../lib/propertyShare";
import { useProspectContact } from "../lib/useProspectContact";
import ProspectContactForm from "./ProspectContactForm";
import "./MatchAlerts.css";

const SHOWN = 3;

// «Le encaja a tus prospectos» (Mi día): una propiedad nueva o que bajó de precio esta semana, con los prospectos a los que les va
// con lo que buscan. Cada uno con su WhatsApp ya escrito (con la propiedad y el enlace); al mandarlo se abre «Registrar contacto» y,
// al guardarlo, ese prospecto deja de salir en esta propiedad (o con «Ya le escribí», si le escribió por otro lado). «Listo» quita la
// propiedad completa. Lo revisado se recuerda en este dispositivo (ver lib/matchAlerts.js).
// `onSeen(keys)` marca llaves como revisadas; `onProspectUpdated(prospecto)` avisa del contacto guardado para que el resto de Mi día
// no quede desfasado. El formulario de contacto es propio de este bloque: así un prospecto no abre dos formularios a la vez.
export default function MatchAlerts({ alerts, advisorName, onSeen, onProspectUpdated }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState({});
  // En qué propiedad se abrió el formulario: un mismo prospecto puede salir en varias y el formulario es uno solo.
  const [formAt, setFormAt] = useState(null); // { alertKey, prospectId }
  const formAtRef = useRef(null);
  const contact = useProspectContact({
    onUpdated: (updated) => {
      onProspectUpdated?.(updated);
      if (formAtRef.current) onSeen([prospectKey(formAtRef.current.alertKey, updated.id)]);
    },
  });

  if (alerts.length === 0) return null;

  const write = (alert, prospect) => {
    formAtRef.current = { alertKey: alert.key, prospectId: prospect.id };
    setFormAt(formAtRef.current);
    contact.open(prospect, "whatsapp", true);
  };

  const renderProspect = (alert, prospect) => {
    const text = propertyShareMessage(alert.property, {
      origin: window.location.origin,
      recipientName: prospect.name,
      advisorName: advisorName(prospect.advisor_id),
      priceDrop: alert.kind === "priceDrop" ? { percent: alert.percent, previousPrice: alert.previousPrice } : null,
    });
    const link = whatsappUrl(prospect.phone, text);
    const open = contact.isOpenFor(prospect.id) && formAt?.alertKey === alert.key && formAt.prospectId === prospect.id;
    return (
      <li key={prospect.id} className="match-alert__prospect">
        <div className="match-alert__who">
          <strong>{prospect.name}</strong>
          <span className="form-hint">{t("matchAlerts.looking", { summary: criteriaSummary(prospect.search_criteria, t) })}</span>
        </div>
        <div className="my-day__actions">
          {link ? (
            <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noopener noreferrer" onClick={() => write(alert, prospect)}>
              {t("matchAlerts.whatsapp")}
            </a>
          ) : (
            <span className="form-hint">{t("matchAlerts.noPhone")}</span>
          )}
          <Link to={`/admin/prospectos/${prospect.id}`} className="btn btn-outline btn-sm">
            {t("matchAlerts.viewProspect")}
          </Link>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onSeen([prospectKey(alert.key, prospect.id)])}>
            {t("matchAlerts.writtenTo")}
          </button>
        </div>
        {open && (
          <ProspectContactForm
            key={`${prospect.id}-${contact.target.channel}`}
            prospect={prospect}
            defaultChannel={contact.target.channel}
            saving={contact.saving}
            error={contact.error}
            onSave={(values) => contact.save(prospect, values)}
            onCancel={contact.close}
          />
        )}
      </li>
    );
  };

  const renderAlert = (alert) => {
    const { property } = alert;
    const showAll = expanded[alert.key];
    // Con el formulario de contacto abierto en un prospecto, se mantiene a la vista aunque no entre en los primeros.
    const list = showAll ? alert.prospects : alert.prospects.slice(0, SHOWN);
    const hidden = alert.prospects.length - list.length;
    return (
      <li key={alert.key} className="card my-day__item match-alert">
        <div className="my-day__body">
          <div className="my-day__headline">
            <strong>{property.title}</strong>
            <span className={`prospect-chip ${alert.kind === "priceDrop" ? "prospect-chip--overdue" : "prospect-chip--today"}`}>
              {alert.kind === "priceDrop" ? t("matchAlerts.drop", { percent: alert.percent }) : t("matchAlerts.new")}
            </span>
          </div>
          <p className="form-hint">
            {[property.zone, formatMXN(property.price), alert.kind === "priceDrop" ? t("matchAlerts.was", { price: formatMXN(alert.previousPrice) }) : null].filter(Boolean).join(" · ")}
          </p>
          <ul className="match-alert__prospects">{list.map((p) => renderProspect(alert, p))}</ul>
          <div className="my-day__actions">
            {hidden > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setExpanded((prev) => ({ ...prev, [alert.key]: true }))}>
                {t("matchAlerts.showMore", { count: hidden })}
              </button>
            )}
            {showAll && alert.prospects.length > SHOWN && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setExpanded((prev) => ({ ...prev, [alert.key]: false }))}>
                {t("matchAlerts.showLess")}
              </button>
            )}
            <a className="btn btn-outline btn-sm" href={`/propiedades/${property.id}`} target="_blank" rel="noopener noreferrer">
              {t("matchAlerts.viewProperty")}
            </a>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onSeen([alert.key])} title={t("matchAlerts.doneHint")}>
              {t("matchAlerts.done")}
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="my-day__section" aria-labelledby="my-day-matches">
      <h2 id="my-day-matches">
        {t("myDay.sections.matches")} <span className="my-day__count">{alerts.length}</span>
      </h2>
      <p className="form-hint">{t("myDay.sections.matchesHint")}</p>
      <ul className="my-day__list">{alerts.map(renderAlert)}</ul>
    </section>
  );
}
