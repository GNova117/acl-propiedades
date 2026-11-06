import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { whatsappDigits } from "../../lib/format";
import { citaToIcs, downloadIcs, mapsUrl } from "../../lib/calendarEvent";
import { canRegisterVisit, citaContact, citaStatus, citaToVisitPrefill, isFromSite, isOpenRequest, isPending, statusActions, visitLink } from "../../lib/agendaCitas";
import { formatIsoDate } from "../../lib/propertyLog";
import CopyVisitLinkButton from "../../components/CopyVisitLinkButton";
import "./admin.css";
import "./AdminAgenda.css";

const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// Semanas completas (lunes a domingo) que cubren el mes, incluyendo los días
// de los meses vecinos necesarios para llenar la primera y última semana —
// así la cuadrícula siempre queda completa en vez de empezar/terminar a la
// mitad de una fila.
function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // retrocede al lunes de esa semana
  const end = new Date(last);
  end.setDate(last.getDate() + (7 - ((last.getDay() + 6) % 7) - 1)); // avanza al domingo de esa semana
  const weeks = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const WEEKDAY_SAMPLE = [new Date(2024, 0, 1), new Date(2024, 0, 2), new Date(2024, 0, 3), new Date(2024, 0, 4), new Date(2024, 0, 5), new Date(2024, 0, 6), new Date(2024, 0, 7)];
const MAX_CHIPS_PER_DAY = 3;

// advisorId es null tanto en modo demo como para cualquier correo sin
// asesor vinculado desde /admin/roles — en ambos casos se ven TODAS las
// citas (RLS ya filtra del lado de Supabase; aquí solo se agrega el
// selector de asesor para poder acotar la vista).
export default function AdminAgenda() {
  const { t, i18n } = useTranslation();
  const { advisorId, hasSection } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [citas, setCitas] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active | pending | open | cancelled | all
  const [busyId, setBusyId] = useState(null);
  const [assignPick, setAssignPick] = useState({}); // cita.id → asesor elegido por administración para una solicitud sin asesor
  const [view, setView] = useState("list");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const seesAll = advisorId == null;

  const load = () => {
    setLoading(true);
    // Las visitas registradas (para saber qué citas ya tienen la suya) solo se piden con el apartado Visitas.
    Promise.all([db.getAgendaCitas(), db.getAdvisors(), db.getClients(), db.getProperties({}).catch(() => []), hasSection("visitas") ? db.getVisits().catch(() => []) : []]).then(([citasData, advisorData, clientData, propertyData, visitData]) => {
      setVisits(visitData);
      setCitas(citasData);
      setAdvisors(advisorData);
      setClients(clientData);
      setProperties(propertyData);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteAgendaCita(id);
    load();
  };

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "—";
  // Datos de contacto de la cita: el cliente ligado o, si la reservó un visitante desde el sitio, lo que dejó al reservar.
  const contactOf = (cita) => citaContact(cita, clients.find((c) => c.id === cita.client_id) || null);
  const whenLabel = (cita) => {
    const date = new Date(`${cita.fecha}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    return cita.hora ? `${date} a las ${cita.hora.slice(0, 5)}` : date;
  };
  const openWhatsApp = (phone, text) => {
    let digits = whatsappDigits(phone);
    if (digits.length === 10) digits = `52${digits}`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  // Recordatorio manual por WhatsApp al cliente (funciona sin esperar el aviso automático).
  const remind = (cita) => {
    const contact = contactOf(cita);
    const place = cita.lugar ? `\n${t("agenda.reminderPlace", { place: cita.lugar })}\n${mapsUrl(cita.lugar)}` : "";
    const text = t("agenda.reminderText", { name: contact.name.split(/\s+/)[0], title: cita.titulo, when: whenLabel(cita), advisor: advisorName(cita.advisor_id) }) + place;
    openWhatsApp(contact.phone, text);
  };

  // Manda por WhatsApp el enlace de la visita (confirmar, cambiar o cancelar) sin depender del correo del cliente.
  const sendLink = (cita, link) => {
    const contact = contactOf(cita);
    openWhatsApp(contact.phone, t("visitLink.whatsappText", { name: contact.name.split(/\s+/)[0], title: cita.titulo, when: whenLabel(cita), advisor: advisorName(cita.advisor_id), link }));
  };

  // Solicitud de visita sin asesor: el cliente pidió un día y una hora y la ven todos los asesores. Un asesor la
  // toma para sí; administración (sin asesor vinculado) la asigna a quien elija. Gana la primera persona que llega.
  const takeRequest = async (cita, chosenId) => {
    if (!chosenId) return;
    if (!window.confirm(t(seesAll ? "agenda.assignConfirm" : "agenda.takeConfirm", { when: whenLabel(cita), name: advisorName(chosenId) }))) return;
    setBusyId(cita.id);
    try {
      const res = await db.claimVisitRequest(cita.id, { advisorId: chosenId });
      if (res?.error) window.alert(t(res.error === "already_taken" || res.error === "not_found" ? "agenda.alreadyTaken" : "agenda.takeError"));
    } catch {
      window.alert(t("agenda.takeError"));
    }
    setBusyId(null);
    load();
  };

  // Escribirle al cliente antes de tomar la solicitud (para ponerse de acuerdo en el horario).
  const writeClient = (cita) => {
    const contact = contactOf(cita);
    openWhatsApp(contact.phone, t("agenda.requestText", { name: contact.name.split(/\s+/)[0], title: cita.titulo, when: whenLabel(cita) }));
  };

  // Cerrar una cita (realizada / no asistió), cancelarla o reactivarla. Al cancelar
  // se pide el motivo (opcional) y se ofrece avisarle al cliente por WhatsApp.
  const changeStatus = async (cita, status) => {
    let reason = "";
    if (status === "cancelada") {
      reason = window.prompt(t("agenda.cancelReasonPrompt"));
      if (reason === null) return;
    }
    setBusyId(cita.id);
    try {
      await db.setAgendaCitaStatus(cita.id, status, { reason });
    } catch (err) {
      window.alert(err.message || t("agenda.statusError"));
      setBusyId(null);
      return;
    }
    setBusyId(null);
    // Al cerrar una visita como realizada se ofrece registrarla (así alimenta el informe de la propiedad).
    if (status === "realizada" && canLogVisits && canRegisterVisit(cita) && !visitByCita.has(cita.id) && window.confirm(t("agenda.registerVisitPrompt"))) {
      registerVisit(cita);
      return;
    }
    if (status === "cancelada") {
      const contact = contactOf(cita);
      // Una visita reservada desde el sitio con correo: el cliente ya recibe el aviso por correo (trigger
      // notify_visit_email); aquí solo se ofrece, además, avisarle por WhatsApp.
      const emailed = isFromSite(cita) && contact.email;
      if (contact.phone && window.confirm(t(emailed ? "agenda.notifyCancelledEmailed" : "agenda.notifyCancelled"))) {
        openWhatsApp(contact.phone, t("agenda.cancelledText", { name: contact.name.split(/\s+/)[0], title: cita.titulo, when: whenLabel(cita), advisor: advisorName(cita.advisor_id) }));
      }
    }
    load();
  };

  // Archivo .ics de la cita: se abre en el calendario del teléfono y avisa 1 h y 15 min antes.
  const addToCalendar = (cita) => {
    const client = clients.find((c) => c.id === cita.client_id);
    const content = citaToIcs(cita, { clientName: client?.name, clientPhone: client?.phone, advisorName: advisorName(cita.advisor_id) });
    downloadIcs(`cita-${cita.fecha}.ics`, content);
  };

  // Visita ya registrada de cada cita (agenda_citas ↔ property_visits.cita_id).
  const visitByCita = new Map(visits.filter((v) => v.cita_id).map((v) => [v.cita_id, v]));
  const canLogVisits = hasSection("visitas");
  // "Registrar visita": abre el formulario ya prellenado con los datos de la cita.
  const registerVisit = (cita) =>
    navigate("/admin/visitas/nueva", { state: { from: "/admin/agenda", prefill: citaToVisitPrefill(cita, clients.find((c) => c.id === cita.client_id) || null) } });

  const propertyOf = (id) => (id ? properties.find((p) => p.id === id) || null : null);

  const visibleCitas = useMemo(() => {
    const byStatus = {
      active: (c) => citaStatus(c) !== "cancelada",
      pending: (c) => isPending(c),
      open: (c) => isOpenRequest(c),
      cancelled: (c) => citaStatus(c) === "cancelada",
      all: () => true,
    }[statusFilter];
    return citas.filter((c) => byStatus(c) && (!seesAll || !advisorFilter || c.advisor_id === advisorFilter));
  }, [citas, seesAll, advisorFilter, statusFilter]);

  const citasByDate = useMemo(() => {
    const map = new Map();
    visibleCitas.forEach((c) => {
      if (!map.has(c.fecha)) map.set(c.fecha, []);
      map.get(c.fecha).push(c);
    });
    map.forEach((list) => list.sort((a, b) => (a.hora || "").localeCompare(b.hora || "")));
    return map;
  }, [visibleCitas]);

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const weekdayLabels = useMemo(() => WEEKDAY_SAMPLE.map((d) => d.toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { weekday: "short" })), [i18n.language]);
  const monthTitle = formatIsoDate(`${cursor.year}-${pad2(cursor.month + 1)}-01`, i18n.language, { month: "long", year: "numeric" });
  const todayIso = isoOf(new Date());

  const changeMonth = (delta) => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{seesAll ? t("agenda.allAgendas") : t("agenda.myAgenda")}</h1>
        <div className="admin-header__actions">
          <div className="agenda-view-toggle" role="group" aria-label={t("agenda.viewToggle")}>
            <button type="button" className={`btn btn-sm ${view === "list" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("list")}>
              {t("agenda.viewList")}
            </button>
            <button type="button" className={`btn btn-sm ${view === "calendar" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("calendar")}>
              {t("agenda.viewCalendar")}
            </button>
          </div>
          <Link to="/admin/agenda/nueva" className="btn btn-primary">
            {t("agenda.newAppointment")}
          </Link>
        </div>
      </div>

      <div className="agenda-filters">
        {seesAll && (
          <div className="form-field">
            <label htmlFor="agenda-advisor-filter">{t("agenda.advisorFilter")}</label>
            <select id="agenda-advisor-filter" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
              <option value="">{t("agenda.allAdvisorsOption")}</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field">
          <label htmlFor="agenda-status-filter">{t("agenda.statusFilter")}</label>
          <select id="agenda-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {["active", "pending", "open", "cancelled", "all"].map((key) => (
              <option key={key} value={key}>
                {t(`agenda.statusFilters.${key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === "list" ? (
        <div className="card admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("agenda.date")}</th>
                <th>{t("agenda.titleField")}</th>
                {seesAll && <th>{t("agenda.advisor")}</th>}
                <th>{t("agenda.client")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={seesAll ? 5 : 4}>{t("common.loading")}</td>
                </tr>
              ) : visibleCitas.length === 0 ? (
                <tr>
                  <td colSpan={seesAll ? 5 : 4}>{t("agenda.noAppointments")}</td>
                </tr>
              ) : (
                visibleCitas.map((cita) => {
                  const status = citaStatus(cita);
                  const contact = contactOf(cita);
                  const property = propertyOf(cita.property_id);
                  const link = status === "confirmada" ? visitLink(cita, window.location.origin) : "";
                  const open = isOpenRequest(cita);
                  return (
                  <tr key={cita.id} className={status === "cancelada" ? "agenda-row--cancelled" : open ? "agenda-row--request" : undefined}>
                    <td>
                      {new Date(`${cita.fecha}T00:00:00`).toLocaleDateString()}
                      {cita.hora ? ` · ${cita.hora.slice(0, 5)}` : ""}
                    </td>
                    <td className="agenda-cell--wrap">
                      <span className="agenda-row__title">{cita.titulo}</span>
                      <div className="agenda-chips">
                        {status !== "confirmada" && <span className={`agenda-chip agenda-chip--${status}`}>{t(`agenda.status.${status}`)}</span>}
                        {isFromSite(cita) && <span className="agenda-chip agenda-chip--site">{t("agenda.fromSite")}</span>}
                        {isFromSite(cita) && isPending(cita) && (
                          <span className={`agenda-chip ${cita.client_confirmed_at ? "agenda-chip--ok" : "agenda-chip--warn"}`}>
                            {cita.client_confirmed_at ? t("agenda.clientConfirmed") : t("agenda.clientUnconfirmed")}
                          </span>
                        )}
                        {cita.reschedule_count > 0 && <span className="agenda-chip">{t("agenda.rescheduled", { count: cita.reschedule_count })}</span>}
                      </div>
                      {open && <div className="form-hint">{t("agenda.requestHint")}</div>}
                      {status === "cancelada" && cita.cancelled_by && (
                        <div className="form-hint">
                          {t(`agenda.cancelledBy.${cita.cancelled_by}`)}
                          {cita.cancelled_reason ? ` — ${cita.cancelled_reason}` : ""}
                        </div>
                      )}
                      {property && (
                        <div className="form-hint">
                          🏠{" "}
                          <a href={`/propiedades/${property.id}`} target="_blank" rel="noopener noreferrer">
                            {property.title}
                          </a>
                        </div>
                      )}
                      {(visitByCita.has(cita.id) || (cita.prospecto_id && hasSection("prospectos"))) && (
                        <div className="form-hint">
                          {visitByCita.has(cita.id) && (
                            <Link to={`/admin/visitas/${visitByCita.get(cita.id).id}`}>✔ {t("agenda.visitRegistered")}</Link>
                          )}
                          {visitByCita.has(cita.id) && cita.prospecto_id && hasSection("prospectos") && " · "}
                          {cita.prospecto_id && hasSection("prospectos") && <Link to={`/admin/prospectos/${cita.prospecto_id}`}>{t("agenda.viewProspect")}</Link>}
                        </div>
                      )}
                      {cita.lugar && (
                        <div className="form-hint">
                          📍 {cita.lugar} ·{" "}
                          <a href={mapsUrl(cita.lugar)} target="_blank" rel="noopener noreferrer">
                            {t("agenda.directions")}
                          </a>
                        </div>
                      )}
                    </td>
                    {seesAll && <td>{open ? t("agenda.noAdvisorChip") : advisorName(cita.advisor_id)}</td>}
                    <td>
                      {contact.name || t("agenda.noClient")}
                      {contact.phone && <div className="form-hint">{contact.phone}</div>}
                    </td>
                    <td>
                      <div className="agenda-actions">
                      {open && !seesAll && advisorId && (
                        <button type="button" className="btn btn-primary btn-sm" disabled={busyId === cita.id} onClick={() => takeRequest(cita, advisorId)} title={t("agenda.takeTitle")}>
                          {t("agenda.take")}
                        </button>
                      )}
                      {open && seesAll && (
                        <span className="agenda-assign">
                          <select aria-label={t("agenda.assignLabel")} value={assignPick[cita.id] || ""} onChange={(e) => setAssignPick((prev) => ({ ...prev, [cita.id]: e.target.value }))}>
                            <option value="">{t("agenda.assignPick")}</option>
                            {advisors.filter((a) => a.active !== false).map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-primary btn-sm" disabled={busyId === cita.id || !assignPick[cita.id]} onClick={() => takeRequest(cita, assignPick[cita.id])}>
                            {t("agenda.assign")}
                          </button>
                        </span>
                      )}
                      {open && contact.phone && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => writeClient(cita)}>
                          {t("agenda.writeClient")}
                        </button>
                      )}
                      {!open && (
                        <>
                      <Link to={`/admin/agenda/${cita.id}`} className="btn btn-outline btn-sm">
                        {t("common.edit")}
                      </Link>
                      <Link to={`/admin/agenda/${cita.id}/expedientes`} className="btn btn-outline btn-sm">
                        {t("agenda.expedientes")}
                      </Link>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => addToCalendar(cita)} title={t("agenda.addToCalendarTitle")}>
                        {t("agenda.addToCalendar")}
                      </button>
                        </>
                      )}
                      {contact.phone && status === "confirmada" && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => remind(cita)}>
                          {t("agenda.remindClient")}
                        </button>
                      )}
                      {link && contact.phone && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => sendLink(cita, link)}>
                          {t("visitLink.send")}
                        </button>
                      )}
                      {link && <CopyVisitLinkButton link={link} />}
                      {status === "realizada" && canLogVisits && canRegisterVisit(cita) && !visitByCita.has(cita.id) && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => registerVisit(cita)}>
                          {t("agenda.registerVisit")}
                        </button>
                      )}
                      {statusActions(cita).map((next) => (
                        <button
                          key={next}
                          type="button"
                          className={`btn btn-sm ${next === "cancelada" ? "btn-outline agenda-action--cancel" : "btn-outline"}`}
                          disabled={busyId === cita.id}
                          onClick={() => changeStatus(cita, next)}
                        >
                          {t(`agenda.statusActions.${next}`)}
                        </button>
                      ))}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(cita.id)}>
                        {t("common.delete")}
                      </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card agenda-calendar">
          <div className="agenda-calendar__nav">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => changeMonth(-1)} aria-label={t("agenda.prevMonth")}>
              ‹
            </button>
            <strong className="agenda-calendar__title">{monthTitle}</strong>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => changeMonth(1)} aria-label={t("agenda.nextMonth")}>
              ›
            </button>
            <button type="button" className="btn btn-outline btn-sm agenda-calendar__today" onClick={goToday}>
              {t("agenda.today")}
            </button>
          </div>

          <div className="agenda-calendar__weekdays">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="agenda-calendar__grid">
            {weeks.map((week, wi) => (
              <div className="agenda-calendar__week" key={wi}>
                {week.map((date) => {
                  const iso = isoOf(date);
                  const inMonth = date.getMonth() === cursor.month;
                  const dayCitas = citasByDate.get(iso) || [];
                  const shown = dayCitas.slice(0, MAX_CHIPS_PER_DAY);
                  return (
                    <div key={iso} className={`agenda-calendar__day${inMonth ? "" : " agenda-calendar__day--out"}${iso === todayIso ? " agenda-calendar__day--today" : ""}`}>
                      <span className="agenda-calendar__day-number">{date.getDate()}</span>
                      <div className="agenda-calendar__chips">
                        {shown.map((cita) => (
                          <Link key={cita.id} to={`/admin/agenda/${cita.id}`} className="agenda-calendar__chip" title={cita.titulo}>
                            {cita.hora ? `${cita.hora.slice(0, 5)} · ` : ""}
                            {cita.titulo}
                          </Link>
                        ))}
                        {dayCitas.length > shown.length && (
                          <button type="button" className="agenda-calendar__more" onClick={() => setView("list")}>
                            {t("agenda.moreAppointments", { count: dayCitas.length - shown.length })}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
