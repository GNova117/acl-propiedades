import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { whatsappDigits } from "../../lib/format";
import { formatIsoDate } from "../../lib/propertyLog";
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
  const { advisorId } = useAuth();
  const [citas, setCitas] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [view, setView] = useState("list");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const seesAll = advisorId == null;

  const load = () => {
    setLoading(true);
    Promise.all([db.getAgendaCitas(), db.getAdvisors(), db.getClients()]).then(([citasData, advisorData, clientData]) => {
      setCitas(citasData);
      setAdvisors(advisorData);
      setClients(clientData);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteAgendaCita(id);
    load();
  };

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "—";
  // Recordatorio manual por WhatsApp al cliente (funciona sin esperar el aviso automático).
  const remind = (cita) => {
    const client = clients.find((c) => c.id === cita.client_id);
    let digits = whatsappDigits(client?.phone);
    if (digits.length === 10) digits = `52${digits}`;
    const date = new Date(`${cita.fecha}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    const when = cita.hora ? `${date} a las ${cita.hora.slice(0, 5)}` : date;
    const text = t("agenda.reminderText", { name: (client?.name || "").split(/\s+/)[0], title: cita.titulo, when, advisor: advisorName(cita.advisor_id) });
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const clientName = (id) => (id ? clients.find((c) => c.id === id)?.name : null) || t("agenda.noClient");

  const visibleCitas = useMemo(() => {
    if (!seesAll || !advisorFilter) return citas;
    return citas.filter((c) => c.advisor_id === advisorFilter);
  }, [citas, seesAll, advisorFilter]);

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

      {seesAll && (
        <div className="form-field" style={{ maxWidth: 320, marginBottom: "1.25rem" }}>
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
                visibleCitas.map((cita) => (
                  <tr key={cita.id}>
                    <td>
                      {new Date(`${cita.fecha}T00:00:00`).toLocaleDateString()}
                      {cita.hora ? ` · ${cita.hora.slice(0, 5)}` : ""}
                    </td>
                    <td>{cita.titulo}</td>
                    {seesAll && <td>{advisorName(cita.advisor_id)}</td>}
                    <td>{clientName(cita.client_id)}</td>
                    <td className="admin-table__actions">
                      <Link to={`/admin/agenda/${cita.id}`} className="btn btn-outline btn-sm">
                        {t("common.edit")}
                      </Link>
                      <Link to={`/admin/agenda/${cita.id}/expedientes`} className="btn btn-outline btn-sm">
                        {t("agenda.expedientes")}
                      </Link>
                      {clients.find((c) => c.id === cita.client_id)?.phone && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => remind(cita)}>
                          {t("agenda.remindClient")}
                        </button>
                      )}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(cita.id)}>
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))
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
