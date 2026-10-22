import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { whatsappDigits } from "../../lib/format";
import { mapsUrl } from "../../lib/calendarEvent";
import { buildDayPlan } from "../../lib/dayPlan";
import { contactFields, isOpenStage, unattendedAge } from "../../lib/prospects";
import { prospectMessageTemplates } from "../../lib/prospectMessages";
import QuickReplyButton from "../../components/QuickReplyButton";
import ProspectContactForm from "../../components/ProspectContactForm";
import "./admin.css";
import "./AdminProspects.css";
import "./AdminMyDay.css";

const telHref = (phone) => {
  const digits = whatsappDigits(phone);
  return digits ? `tel:${digits.length === 10 ? `+52${digits}` : `+${digits}`}` : null;
};

const hm = (hora) => String(hora).slice(0, 5);

// "Mi día": una sola pantalla con lo de hoy en el orden en que conviene
// atenderlo (ver lib/dayPlan.js): citas con su hora y, abajo, los prospectos a
// los que hay que escribir — sin atender, seguimientos vencidos y de hoy — con
// los mismos atajos de Prospectos (mensaje rápido, llamar, registrar contacto).
// Muestra solo lo de los apartados que el rol tiene.
export default function AdminMyDay() {
  const { t, i18n } = useTranslation();
  const { hasSection, advisorId } = useAuth();
  const canAgenda = hasSection("agenda");
  const canProspects = hasSection("prospectos");
  const canVisits = hasSection("visitas");

  const [citas, setCitas] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [contactFor, setContactFor] = useState(null); // { id, channel }
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const safe = (load, fallback = []) => load().catch(() => fallback);
    Promise.all([
      canAgenda ? safe(() => db.getAgendaCitas()) : [],
      canProspects ? safe(() => db.getProspects()) : [],
      canAgenda ? safe(() => db.getClients()) : [],
      canProspects ? safe(() => db.getProperties({})) : [],
      safe(() => db.getAdvisors()),
    ]).then(([citaData, prospectData, clientData, propertyData, advisorData]) => {
      if (cancelled) return;
      setCitas(citaData);
      setProspects(prospectData);
      setClients(clientData);
      setProperties(propertyData);
      setAdvisors(advisorData);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [canAgenda, canProspects]);

  // La cita "próxima" y los minutos que faltan se recalculan cada minuto.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const plan = useMemo(() => buildDayPlan({ citas, prospects, now }), [citas, prospects, now]);

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "";
  const propertyTitle = (id) => properties.find((p) => p.id === id)?.title || "";
  const client = (id) => clients.find((c) => c.id === id) || null;
  // La oficina ve lo de todos: ahí sirve saber de qué asesor es cada cosa.
  const showAdvisor = advisorId == null;

  const templatesFor = (p) =>
    prospectMessageTemplates(p, {
      propertyTitle: propertyTitle(p.property_id),
      propertyUrl: p.property_id ? `${window.location.origin}/propiedades/${p.property_id}` : "",
      advisorName: advisorName(p.advisor_id),
    }).map((tpl) => ({ ...tpl, label: t(`prospects.templates.${tpl.key}`) }));

  const openContact = (prospect, channel = "", force = false) => {
    setContactError("");
    setContactFor((current) => (!force && current?.id === prospect.id ? null : { id: prospect.id, channel }));
  };

  // Igual que en Prospectos: al guardar el contacto el prospecto deja de estar
  // pendiente (cambia su seguimiento) y sale de esta lista solo.
  const saveContact = async (prospect, { channel, note, nextFollowup }) => {
    setContactSaving(true);
    setContactError("");
    try {
      const updated = await db.logProspectContact(prospect.id, contactFields(prospect, nextFollowup), { channel, note });
      setProspects((prev) => prev.map((p) => (p.id === prospect.id ? updated : p)));
      setContactFor(null);
    } catch (err) {
      setContactError(err.message || t("prospects.saveError"));
    } finally {
      setContactSaving(false);
    }
  };

  const dateTitle = now.toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { weekday: "long", day: "numeric", month: "long" });

  const citaChip = ({ state, minutesUntil }) => {
    if (state === "now") return <span className="prospect-chip prospect-chip--today">{t("myDay.agenda.now")}</span>;
    if (state === "next") return <span className="prospect-chip prospect-chip--today">{t("myDay.agenda.inMinutes", { count: minutesUntil })}</span>;
    if (state === "past") return <span className="prospect-chip">{t("myDay.agenda.past")}</span>;
    return null;
  };

  const renderCita = (item) => {
    const { cita, state } = item;
    const cl = client(cita.client_id);
    const call = telHref(cl?.phone);
    return (
      <li key={cita.id} className={`card my-day__item my-day__item--${state}`}>
        <div className="my-day__time">{cita.hora ? hm(cita.hora) : t("myDay.agenda.allDay")}</div>
        <div className="my-day__body">
          <div className="my-day__headline">
            <strong>{cita.titulo}</strong> {citaChip(item)}
          </div>
          {(cl || showAdvisor) && (
            <p className="form-hint">{[cl?.name, showAdvisor ? advisorName(cita.advisor_id) : null].filter(Boolean).join(" · ")}</p>
          )}
          {cita.lugar && <p className="form-hint">📍 {cita.lugar}</p>}
          <div className="my-day__actions">
            {cita.lugar && (
              <a className="btn btn-outline btn-sm" href={mapsUrl(cita.lugar)} target="_blank" rel="noopener noreferrer">
                {t("agenda.directions")}
              </a>
            )}
            {call && (
              <a className="btn btn-outline btn-sm" href={call}>
                {t("myDay.call")}
              </a>
            )}
            {canVisits && (
              <Link to="/admin/visitas/nueva" className="btn btn-outline btn-sm">
                {t("myDay.agenda.logVisit")}
              </Link>
            )}
            <Link to={`/admin/agenda/${cita.id}`} className="btn btn-outline btn-sm">
              {t("common.edit")}
            </Link>
          </div>
        </div>
      </li>
    );
  };

  const renderProspect = (entry, chip) => {
    const p = entry.prospect;
    const call = telHref(p.phone);
    const looking = [propertyTitle(p.property_id), p.looking_for].filter(Boolean).join(" · ");
    return (
      <li key={p.id} className="card my-day__item my-day__item--prospect">
        <div className="my-day__body">
          <div className="my-day__headline">
            <strong>{p.name}</strong> {chip}
            <span className="prospect-chip">{t(`prospects.stages.${p.stage}`)}</span>
          </div>
          {(looking || (showAdvisor && p.advisor_id)) && (
            <p className="form-hint">{[looking, showAdvisor ? advisorName(p.advisor_id) : null].filter(Boolean).join(" · ")}</p>
          )}
          <div className="my-day__actions">
            {isOpenStage(p.stage) && (
              <QuickReplyButton
                templates={templatesFor(p)}
                phone={p.phone}
                email={p.email}
                emailSubject="ACL Propiedades"
                label={t("prospects.templates.label")}
                onSend={(_template, channel) => openContact(p, channel, true)}
              />
            )}
            {call && (
              <a className="btn btn-outline btn-sm" href={call} onClick={() => openContact(p, "llamada", true)}>
                {t("myDay.call")}
              </a>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openContact(p)} aria-expanded={contactFor?.id === p.id}>
              {t("prospects.logContact")}
            </button>
            <Link to={`/admin/prospectos/${p.id}`} className="btn btn-outline btn-sm">
              {t("prospects.match.openProspect")}
            </Link>
          </div>
          {contactFor?.id === p.id && (
            <ProspectContactForm
              key={`${p.id}-${contactFor.channel}`}
              prospect={p}
              defaultChannel={contactFor.channel}
              saving={contactSaving}
              error={contactError}
              onSave={(values) => saveContact(p, values)}
              onCancel={() => setContactFor(null)}
            />
          )}
        </div>
      </li>
    );
  };

  const unattendedChip = ({ hours, level }) => {
    const age = unattendedAge(hours);
    return <span className={`prospect-chip prospect-chip--${level === "late" ? "overdue" : "today"}`}>{t(`prospects.unattended.${age.unit}`, { count: age.count })}</span>;
  };

  const section = (key, items, render, count = items.length) =>
    items.length > 0 && (
      <section className="my-day__section" aria-labelledby={`my-day-${key}`}>
        <h2 id={`my-day-${key}`}>
          {t(`myDay.sections.${key}`)} <span className="my-day__count">{count}</span>
        </h2>
        <p className="form-hint">{t(`myDay.sections.${key}Hint`)}</p>
        <ul className="my-day__list">{items.map(render)}</ul>
      </section>
    );

  if (!canAgenda && !canProspects) return <div className="empty-state">{t("accessControl.restricted")}</div>;
  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div className="my-day">
      <div className="admin-header">
        <div>
          <h1>{t("myDay.title")}</h1>
          <p className="form-hint my-day__date">{dateTitle}</p>
        </div>
        <div className="admin-header__actions">
          {canAgenda && (
            <Link to="/admin/agenda" className="btn btn-outline">
              {t("myDay.fullAgenda")}
            </Link>
          )}
          {canProspects && (
            <Link to="/admin/prospectos" className="btn btn-outline">
              {t("myDay.allProspects")}
            </Link>
          )}
        </div>
      </div>

      {plan.isEmpty ? (
        <p className="card my-day__clear">{t("myDay.allClear")}</p>
      ) : (
        <p className="my-day__summary">{t("myDay.summary", { appointments: plan.pendingAgenda, contacts: plan.toContact })}</p>
      )}

      {canAgenda && section("agenda", plan.agenda, renderCita, plan.pendingAgenda)}
      {canProspects && section("urgent", plan.urgent, (e) => renderProspect(e, unattendedChip(e)))}
      {canProspects &&
        section("overdue", plan.overdue, (e) =>
          renderProspect(e, <span className="prospect-chip prospect-chip--overdue">{t("myDay.daysLate", { count: e.daysLate })}</span>)
        )}
      {canProspects && section("today", plan.today, (e) => renderProspect(e, <span className="prospect-chip prospect-chip--today">{t("prospects.followToday")}</span>))}
    </div>
  );
}
