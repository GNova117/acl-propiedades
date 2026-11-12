import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { whatsappDigits } from "../../lib/format";
import { mapsUrl } from "../../lib/calendarEvent";
import { buildDayPlan } from "../../lib/dayPlan";
import { canRegisterVisit, citaContact, citaToVisitPrefill, isFromSite, isPending, visitLink } from "../../lib/agendaCitas";
import { isOpenStage, unattendedAge } from "../../lib/prospects";
import { quickTemplates, telHref } from "../../lib/prospectActions";
import { prospectToCitaPrefill } from "../../lib/prospectAgenda";
import { useProspectContact } from "../../lib/useProspectContact";
import { queries } from "../../lib/queries";
import { useQuery } from "../../lib/useQuery";
import QuickReplyButton from "../../components/QuickReplyButton";
import CopyVisitLinkButton from "../../components/CopyVisitLinkButton";
import ProspectContactForm from "../../components/ProspectContactForm";
import MonthGoals from "../../components/MonthGoals";
import { HOME_MY_DAY, HOME_PANEL } from "../../lib/adminHome";
import { useAdminHome } from "../../lib/useAdminHome";
import "./admin.css";
import "./AdminProspects.css";
import "./AdminMyDay.css";

const hm = (hora) => String(hora).slice(0, 5);
const NONE = [];

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
  const { home, setHome } = useAdminHome();

  // Las listas salen del caché (ver dataCache.js): si ya se pidieron en otra pantalla, Mi día se
  // pinta al instante y se actualiza al llegar lo nuevo. Cada una solo con el apartado que el rol tiene.
  const citasQ = useQuery(queries.citas, { enabled: canAgenda });
  const prospectsQ = useQuery(queries.prospects, { enabled: canProspects });
  const clientsQ = useQuery(queries.clients(), { enabled: canAgenda });
  const propertiesQ = useQuery(queries.properties, { enabled: canProspects });
  const advisorsQ = useQuery(queries.advisors);
  const citas = citasQ.data ?? NONE;
  const prospects = prospectsQ.data ?? NONE;
  const clients = clientsQ.data ?? NONE;
  const properties = propertiesQ.data ?? NONE;
  const advisors = advisorsQ.data ?? NONE;
  const loading = (canAgenda && citasQ.loading) || (canProspects && prospectsQ.loading);
  const [now, setNow] = useState(() => new Date());
  // "Registrar contacto" bajo la tarjeta: al guardar, el prospecto deja de estar
  // pendiente (cambia su seguimiento) y sale de esta lista solo.
  const prospectContact = useProspectContact({
    onUpdated: (updated) => prospectsQ.mutate((prev) => prev.map((p) => (p.id === updated.id ? updated : p))),
  });

  // La cita "próxima" y los minutos que faltan se recalculan cada minuto.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const plan = useMemo(() => buildDayPlan({ citas, prospects, now }), [citas, prospects, now]);

  // Cerrar una visita pasada: realizada o "no asistió". Vuelve a leer las citas para que salga de la lista.
  const [closeError, setCloseError] = useState("");
  const closeCita = async (cita, status) => {
    setCloseError("");
    try {
      await db.setAgendaCitaStatus(cita.id, status);
      await citasQ.reload();
    } catch (err) {
      setCloseError(err.message || t("myDay.close.error"));
    }
  };

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "";
  const propertyTitle = (id) => properties.find((p) => p.id === id)?.title || "";
  const client = (id) => clients.find((c) => c.id === id) || null;
  // La oficina ve lo de todos: ahí sirve saber de qué asesor es cada cosa.
  const showAdvisor = advisorId == null;

  const templatesFor = (p) =>
    quickTemplates(p, { propertyTitle: propertyTitle(p.property_id), advisorName: advisorName(p.advisor_id), origin: window.location.origin, t });

  const dateTitle = now.toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { weekday: "long", day: "numeric", month: "long" });

  const citaChip = ({ state, minutesUntil }) => {
    if (state === "now") return <span className="prospect-chip prospect-chip--today">{t("myDay.agenda.now")}</span>;
    if (state === "next") return <span className="prospect-chip prospect-chip--today">{t("myDay.agenda.inMinutes", { count: minutesUntil })}</span>;
    if (state === "past") return <span className="prospect-chip">{t("myDay.agenda.past")}</span>;
    return null;
  };

  const renderCita = (item) => {
    const { cita, state } = item;
    const cl = citaContact(cita, client(cita.client_id));
    const call = telHref(cl.phone);
    return (
      <li key={cita.id} className={`card my-day__item my-day__item--${state}`}>
        <div className="my-day__time">{cita.hora ? hm(cita.hora) : t("myDay.agenda.allDay")}</div>
        <div className="my-day__body">
          <div className="my-day__headline">
            <strong>{cita.titulo}</strong> {citaChip(item)}
            {isFromSite(cita) && <span className="prospect-chip">{t("agenda.fromSite")}</span>}
          </div>
          {(cl.name || showAdvisor) && (
            <p className="form-hint">{[cl.name, showAdvisor ? advisorName(cita.advisor_id) : null].filter(Boolean).join(" · ")}</p>
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
              <Link to="/admin/visitas/nueva" state={{ from: "/admin/mi-dia", prefill: citaToVisitPrefill(cita, client(cita.client_id)) }} className="btn btn-outline btn-sm">
                {t("myDay.agenda.logVisit")}
              </Link>
            )}
            {state === "past" && cita.property_id && isPending(cita) && renderCloseButtons(cita)}
            <Link to={`/admin/agenda/${cita.id}`} className="btn btn-outline btn-sm">
              {t("common.edit")}
            </Link>
          </div>
        </div>
      </li>
    );
  };

  // Realizada / No asistió (una visita que ya pasó y nadie ha cerrado).
  const renderCloseButtons = (cita) => (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => closeCita(cita, "realizada")}>
        {t("myDay.close.done")}
      </button>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => closeCita(cita, "no_asistio")}>
        {t("myDay.close.noShow")}
      </button>
    </>
  );

  // Visita de un día anterior que nadie cerró: se cierra aquí o se registra directo (que la marca como realizada).
  const renderToClose = (cita) => {
    const contact = citaContact(cita, client(cita.client_id));
    const day = new Date(`${cita.fecha}T00:00:00`).toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { weekday: "long", day: "numeric", month: "long" });
    return (
      <li key={cita.id} className="card my-day__item my-day__item--prospect">
        <div className="my-day__body">
          <div className="my-day__headline">
            <strong>{cita.titulo}</strong> <span className="prospect-chip prospect-chip--overdue">{`${day} · ${hm(cita.hora)}`}</span>
          </div>
          <p className="form-hint">{[contact.name, contact.phone, showAdvisor ? advisorName(cita.advisor_id) : null].filter(Boolean).join(" · ")}</p>
          <div className="my-day__actions">
            {renderCloseButtons(cita)}
            {canVisits && canRegisterVisit(cita) && (
              <Link to="/admin/visitas/nueva" state={{ from: "/admin/mi-dia", prefill: citaToVisitPrefill(cita, client(cita.client_id)) }} className="btn btn-outline btn-sm">
                {t("myDay.close.register")}
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

  // Reserva hecha desde el sitio cuyo cliente aún no confirma que va: se le escribe por WhatsApp o se le llama.
  const dayLabel = (fecha) => {
    const today = now.toLocaleDateString("en-CA");
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (fecha === today) return t("myDay.confirm.today");
    if (fecha === tomorrow.toLocaleDateString("en-CA")) return t("myDay.confirm.tomorrow");
    return new Date(`${fecha}T00:00:00`).toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { weekday: "long", day: "numeric", month: "long" });
  };

  const renderToConfirm = (cita) => {
    const contact = citaContact(cita, client(cita.client_id));
    const call = telHref(contact.phone);
    const digits = whatsappDigits(contact.phone);
    const waPhone = digits.length === 10 ? `52${digits}` : digits;
    const when = `${dayLabel(cita.fecha)} ${t("myDay.confirm.at")} ${hm(cita.hora)}`;
    const link = visitLink(cita, window.location.origin);
    const textParams = { name: contact.name.split(/\s+/)[0], title: cita.titulo, when, advisor: advisorName(cita.advisor_id) };
    // Con el enlace de la visita el cliente confirma con un toque, sin depender del correo.
    const text = link ? t("visitLink.whatsappText", { ...textParams, link }) : t("myDay.confirm.whatsappText", textParams);
    return (
      <li key={cita.id} className="card my-day__item my-day__item--prospect">
        <div className="my-day__body">
          <div className="my-day__headline">
            <strong>{cita.titulo}</strong> <span className="prospect-chip prospect-chip--today">{when}</span>
          </div>
          <p className="form-hint">{[contact.name, contact.phone, showAdvisor ? advisorName(cita.advisor_id) : null].filter(Boolean).join(" · ")}</p>
          <div className="my-day__actions">
            {waPhone && (
              <a className="btn btn-outline btn-sm" href={`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                {t("myDay.confirm.ask")}
              </a>
            )}
            {link && <CopyVisitLinkButton link={link} />}
            {call && (
              <a className="btn btn-outline btn-sm" href={call}>
                {t("myDay.call")}
              </a>
            )}
            <Link to={`/admin/agenda/${cita.id}`} className="btn btn-outline btn-sm">
              {t("common.edit")}
            </Link>
          </div>
        </div>
      </li>
    );
  };

  // Solicitud de visita sin asesor: la ven todos los asesores; la primera persona que la toma se la queda.
  const takeRequest = async (cita) => {
    const whenText = `${dayLabel(cita.fecha)} ${t("myDay.confirm.at")} ${hm(cita.hora)}`;
    if (!window.confirm(t("agenda.takeConfirm", { when: whenText }))) return;
    setCloseError("");
    try {
      const res = await db.claimVisitRequest(cita.id, { advisorId });
      if (res?.error) setCloseError(t(res.error === "already_taken" || res.error === "not_found" ? "agenda.alreadyTaken" : "agenda.takeError"));
    } catch {
      setCloseError(t("agenda.takeError"));
    }
    await citasQ.reload().catch(() => {});
  };

  const renderRequest = (cita) => {
    const contact = citaContact(cita, null);
    const digits = whatsappDigits(contact.phone);
    const waPhone = digits.length === 10 ? `52${digits}` : digits;
    const when = `${dayLabel(cita.fecha)} ${t("myDay.confirm.at")} ${hm(cita.hora)}`;
    const text = t("agenda.requestText", { name: contact.name.split(/\s+/)[0], title: cita.titulo, when });
    return (
      <li key={cita.id} className="card my-day__item my-day__item--prospect">
        <div className="my-day__body">
          <div className="my-day__headline">
            <strong>{cita.titulo}</strong> <span className="prospect-chip prospect-chip--today">{when}</span>
          </div>
          <p className="form-hint">{[contact.name, contact.phone].filter(Boolean).join(" · ")}</p>
          <div className="my-day__actions">
            {advisorId && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => takeRequest(cita)} title={t("agenda.takeTitle")}>
                {t("agenda.take")}
              </button>
            )}
            {waPhone && (
              <a className="btn btn-outline btn-sm" href={`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                {t("agenda.writeClient")}
              </a>
            )}
            {!advisorId && (
              <Link to="/admin/agenda" className="btn btn-outline btn-sm">
                {t("myDay.fullAgenda")}
              </Link>
            )}
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
                recommendedLabel={t("prospects.templates.forStage", { stage: t(`prospects.stages.${p.stage}`) })}
                othersLabel={t("prospects.templates.others")}
                onSend={(_template, channel) => prospectContact.open(p, channel, true)}
              />
            )}
            {call && (
              <a className="btn btn-outline btn-sm" href={call} onClick={() => prospectContact.open(p, "llamada", true)}>
                {t("myDay.call")}
              </a>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => prospectContact.open(p)} aria-expanded={prospectContact.isOpenFor(p.id)}>
              {t("prospects.logContact")}
            </button>
            {canAgenda && (
              <Link
                to="/admin/agenda/nueva"
                state={{ from: "/admin/mi-dia", prefill: prospectToCitaPrefill(p, { propertyTitle: propertyTitle(p.property_id), t }) }}
                className="btn btn-outline btn-sm"
              >
                {t("prospects.schedule")}
              </Link>
            )}
            <Link to={`/admin/prospectos/${p.id}`} className="btn btn-outline btn-sm">
              {t("prospects.match.openProspect")}
            </Link>
          </div>
          {prospectContact.isOpenFor(p.id) && (
            <ProspectContactForm
              key={`${p.id}-${prospectContact.target.channel}`}
              prospect={p}
              defaultChannel={prospectContact.target.channel}
              saving={prospectContact.saving}
              error={prospectContact.error}
              onSave={(values) => prospectContact.save(p, values)}
              onCancel={prospectContact.close}
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
      {/* Título y fecha en un renglón; los enlaces a Agenda y Prospectos solo en pantalla ancha
          (en el teléfono ya están en la barra de abajo). */}
      <div className="admin-header my-day__header">
        <h1>{t("myDay.title")}</h1>
        <p className="form-hint my-day__date">{dateTitle}</p>
        <div className="admin-header__actions my-day__links">
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

      {advisorId && (
        <div className="my-day__goals">
          <MonthGoals advisorId={advisorId} />
        </div>
      )}

      {plan.isEmpty ? (
        <p className="card my-day__clear">{t("myDay.allClear")}</p>
      ) : (
        <p className="my-day__summary">{t("myDay.summary", { appointments: plan.pendingAgenda, contacts: plan.toContact })}</p>
      )}

      {canAgenda && section("agenda", plan.agenda, renderCita, plan.pendingAgenda)}
      {canAgenda && section("requests", plan.requests, renderRequest)}
      {canAgenda && section("confirm", plan.toConfirm, renderToConfirm)}
      {canAgenda && section("close", plan.toClose, renderToClose)}
      {closeError && (
        <p className="form-error" role="alert">
          {closeError}
        </p>
      )}
      {canProspects && section("urgent", plan.urgent, (e) => renderProspect(e, unattendedChip(e)))}
      {canProspects &&
        section("overdue", plan.overdue, (e) =>
          renderProspect(e, <span className="prospect-chip prospect-chip--overdue">{t("myDay.daysLate", { count: e.daysLate })}</span>)
        )}
      {canProspects && section("today", plan.today, (e) => renderProspect(e, <span className="prospect-chip prospect-chip--today">{t("prospects.followToday")}</span>))}

      {/* Preferencia de este dispositivo: va al final, para que la primera cita se vea sin deslizar. */}
      <label className="my-day__home-toggle">
        <input type="checkbox" checked={home === HOME_MY_DAY} onChange={(e) => setHome(e.target.checked ? HOME_MY_DAY : HOME_PANEL)} />
        {t("myDay.homeToggle")}
      </label>
    </div>
  );
}
