import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { useAuth } from "../context/AuthContext";
import { queries } from "../lib/queries";
import { useQuery } from "../lib/useQuery";
import { buildTimeline } from "../lib/prospectTimeline";
import { agoText } from "../lib/selections";
import "./ProspectTimeline.css";

const NONE = [];
const FIRST_PAGE = 12;

// Fecha y hora cortas («12 nov, 10:30»; con el año si no es el actual).
function formatWhen(ms) {
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString("es-MX", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit" });
}

// Línea de tiempo de la ficha de un prospecto (lógica en lib/prospectTimeline.js): cuándo llegó, cada
// contacto, cada cambio de etapa, sus citas y visitas y las notas del equipo, en un solo historial por
// fecha, con la cita que viene (si hay) arriba. Las citas y las visitas solo se piden con el apartado
// que el rol tiene; las listas salen del caché compartido (ver dataCache.js). `refreshKey`: sube cuando la
// ficha registra un contacto, cambia la etapa o se agrega una nota, para volver a leer lo que cambió.
export default function ProspectTimeline({ prospect, properties = NONE, refreshKey = 0 }) {
  const { t, i18n } = useTranslation();
  const { hasSection } = useAuth();
  const canAgenda = hasSection("agenda");
  const canVisits = hasSection("visitas");
  const citasQ = useQuery(queries.citas, { enabled: canAgenda });
  const visitsQ = useQuery(queries.visits, { enabled: canVisits });
  const stagesQ = useQuery(queries.stageHistory);
  const selectionsQ = useQuery(queries.selections);
  const [contacts, setContacts] = useState(null);
  const [notes, setNotes] = useState(NONE);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.getProspectContacts(prospect.id), db.getInternalNotes("prospect", prospect.id).catch(() => NONE)])
      .then(([contactRows, noteRows]) => {
        if (cancelled) return;
        setContacts(contactRows);
        setNotes(noteRows);
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message || "Error"));
    return () => {
      cancelled = true;
    };
  }, [prospect.id, refreshKey]);

  // El historial de etapas también cambia al registrar un contacto (de «nuevo» a «contactado»).
  const firstRun = useRef(true);
  const reloadStages = stagesQ.reload;
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    reloadStages().catch(() => {});
  }, [refreshKey, reloadStages]);

  const items = useMemo(
    () => buildTimeline({ prospect, contacts: contacts ?? NONE, stages: stagesQ.data ?? NONE, citas: citasQ.data ?? NONE, visits: visitsQ.data ?? NONE, notes, selections: selectionsQ.data ?? NONE }),
    [prospect, contacts, stagesQ.data, citasQ.data, visitsQ.data, notes, selectionsQ.data]
  );
  const shown = showAll ? items : items.slice(0, FIRST_PAGE);
  const propertyTitle = (id) => properties.find((p) => p.id === id)?.title || "";

  const describe = (item) => {
    switch (item.kind) {
      case "created":
        return { text: t("prospects.timeline.created", { source: t(`prospects.sources.${item.source || "manual"}`) }) };
      case "contact":
        return {
          chip: t(`prospects.contact.channels.${item.channel}`, { defaultValue: item.channel }),
          text: item.note,
          detail: item.actor,
        };
      case "stage":
        return { text: t("prospects.timeline.stageTo", { stage: t(`prospects.stages.${item.stage}`) }) };
      case "appointment":
        return {
          chip: t(`agenda.status.${item.status}`, { defaultValue: item.status }),
          text: item.title,
          detail: item.place ? `📍 ${item.place}` : "",
          to: canAgenda ? `/admin/agenda/${item.citaId}` : null,
        };
      case "visit":
        return {
          chip: t(`visits.interest.${item.interest}`, { defaultValue: "" }),
          text: t("prospects.timeline.visitTo", { property: propertyTitle(item.propertyId) || "—" }),
          detail: item.comments,
          to: canVisits ? `/admin/visitas/${item.visitId}` : null,
        };
      case "selection":
        return {
          text: t("prospects.timeline.selectionSent", { count: item.count, title: item.title || t("selection.public.defaultTitle") }),
          detail: item.revoked ? t("prospects.timeline.selectionRevoked") : "",
        };
      case "selectionOpened":
        return {
          text: t("prospects.timeline.selectionOpenedText", { title: item.title || t("selection.public.defaultTitle") }),
          detail: item.opens > 1 ? t("prospects.timeline.selectionOpenedTimes", { count: item.opens, ago: agoText(item.lastAt, i18n.language) }) : "",
        };
      default:
        return { text: item.body, detail: item.author };
    }
  };

  return (
    <section className="card prospect-timeline" aria-label={t("prospects.timeline.title")}>
      <h2 className="prospect-timeline__title">{t("prospects.timeline.title")}</h2>
      {error && <p className="form-error">{error}</p>}
      {contacts === null && !error && <p className="form-hint">…</p>}
      <ol className="prospect-timeline__list">
        {shown.map((item) => {
          const { chip, text, detail, to } = describe(item);
          return (
            <li key={item.id} className={`prospect-timeline__item prospect-timeline__item--${item.kind}${item.upcoming ? " is-upcoming" : ""}`} data-kind={item.kind}>
              <span className="prospect-timeline__dot" aria-hidden="true" />
              <div className="prospect-timeline__body">
                <div className="prospect-timeline__head">
                  <span className="prospect-chip">{t(`prospects.timeline.kinds.${item.kind}`)}</span>
                  {item.upcoming && <span className="prospect-chip prospect-chip--today">{t("prospects.timeline.upcoming")}</span>}
                  {chip && <span className="prospect-chip">{chip}</span>}
                  <time className="prospect-timeline__when" dateTime={new Date(item.at).toISOString()}>
                    {formatWhen(item.at)}
                  </time>
                </div>
                {text && <p className="prospect-timeline__text">{to ? <Link to={to}>{text}</Link> : text}</p>}
                {detail && <p className="form-hint prospect-timeline__detail">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {items.length > FIRST_PAGE && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? t("prospects.timeline.showLess") : t("prospects.timeline.showMore", { count: items.length - FIRST_PAGE })}
        </button>
      )}
    </section>
  );
}
