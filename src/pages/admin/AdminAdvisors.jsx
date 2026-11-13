import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "../../lib/useQuery";
import { queries } from "../../lib/queries";
import { buildAdvisorStats } from "../../lib/advisorStats";
import "./admin.css";

const NONE = [];

// Lista de Asesores (la oficina): quién es cada uno y, de un vistazo, cómo va —prospectos abiertos y cuántos piden atención,
// propiedades disponibles, visitas del mes, lo que le queda hoy en la agenda y si está ausente (lib/advisorStats.js)—. Cada cifra con
// algo lleva a Prospectos ya filtrado por ese asesor. Solo se pide lo que el rol puede leer: sin el apartado, esa columna sale con «—».
export default function AdminAdvisors() {
  const { t, i18n } = useTranslation();
  const { hasSection } = useAuth();
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const canProspects = hasSection("prospectos");
  const canVisits = hasSection("visitas");
  const canAgenda = hasSection("agenda");

  const prospectsQ = useQuery(queries.prospects, { enabled: canProspects });
  const visitsQ = useQuery(queries.visits, { enabled: canVisits });
  const citasQ = useQuery(queries.citas, { enabled: canAgenda });
  const propertiesQ = useQuery(queries.properties);
  const timeOffQ = useQuery(queries.timeOff, { enabled: canAgenda });
  const [now, setNow] = useState(() => new Date());

  const load = () => {
    setLoading(true);
    db.getAdvisors().then((data) => {
      setAdvisors(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  // Las cifras se recalculan cada minuto (la hora de las citas y «sin atender» avanzan solas).
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(
    () =>
      buildAdvisorStats({
        advisors,
        prospects: prospectsQ.data ?? NONE,
        properties: propertiesQ.data ?? NONE,
        visits: visitsQ.data ?? NONE,
        citas: citasQ.data ?? NONE,
        timeOff: timeOffQ.data ?? NONE,
        now,
      }),
    [advisors, prospectsQ.data, propertiesQ.data, visitsQ.data, citasQ.data, timeOffQ.data, now]
  );

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteAdvisor(id);
    load();
  };

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
  const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const prospectsLink = (advisor, extra) => `/admin/prospectos?${new URLSearchParams({ asesor: advisor.id, ...extra }).toString()}`;

  // Una cifra de la fila: con valor, el número; sin el apartado para leerla, «—». Con `to` y algo que ver, enlaza.
  const stat = (value, available, { to, warn = false } = {}) => {
    if (!available) return <span className="form-hint">—</span>;
    if (to && value > 0) return <Link to={to} className={warn ? "advisor-stat advisor-stat--warn" : "advisor-stat"}>{value}</Link>;
    return <span className={`advisor-stat${value === 0 ? " advisor-stat--zero" : ""}`}>{value}</span>;
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.advisors")}</h1>
        <Link to="/admin/asesores/nuevo" className="btn btn-primary">
          {t("admin.newAdvisor")}
        </Link>
      </div>

      {canProspects && !loading && (
        <ul className="advisor-totals" aria-label={t("advisorList.totals")}>
          {[
            ["openProspects", stats.totals.openProspects],
            ["unattended", stats.totals.unattended],
            ["overdue", stats.totals.overdue],
            ["properties", stats.totals.properties],
          ].map(([key, count]) => (
            <li key={key} className={count === 0 ? "is-zero" : ""} data-total={key}>
              <strong>{count}</strong>
              <span>{t(`advisorList.cols.${key}`)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="card admin-table-wrapper admin-table-wrapper--cards">
        <table className="admin-table admin-table--cards admin-table--advisors">
          <thead>
            <tr>
              <th></th>
              <th>Nombre</th>
              <th className="cell-stat" title={t("advisorList.cols.openProspects")}>{t("advisorList.short.openProspects")}</th>
              <th className="cell-stat" title={t("advisorList.cols.unattended")}>{t("advisorList.short.unattended")}</th>
              <th className="cell-stat" title={t("advisorList.cols.overdue")}>{t("advisorList.short.overdue")}</th>
              <th className="cell-stat" title={t("advisorList.cols.properties")}>{t("advisorList.short.properties")}</th>
              <th className="cell-stat" title={t("advisorList.cols.visitsMonth")}>{t("advisorList.short.visitsMonth")}</th>
              <th className="cell-stat" title={t("advisorList.cols.agendaToday")}>{t("advisorList.short.agendaToday")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10}>{t("common.loading")}</td></tr>
            ) : advisors.length === 0 ? (
              <tr><td colSpan={10}>{t("properties.noResults")}</td></tr>
            ) : (
              stats.rows.map(({ advisor, openProspects, unattended, late, overdue, properties, visitsMonth, agendaToday, absentUntil, needsAttention }) => (
                <tr key={advisor.id} className={`admin-row${needsAttention ? " advisor-row--attention" : ""}`} data-advisor={advisor.id}>
                  <td className="cell-photo">{advisor.photo_url && <img src={advisor.photo_url} alt="" />}</td>
                  <td className="cell-name">
                    <strong>{advisor.name}</strong>
                    <span className="advisor-contact">{[advisor.phone, advisor.email].filter(Boolean).join(" · ")}</span>
                    {absentUntil && <span className="advisor-away" data-away="1">{t("absences.awayUntil", { date: dayLabel(absentUntil) })}</span>}
                  </td>
                  <td className="cell-stat cell-open" data-label={t("advisorList.short.openProspects")}>
                    {stat(openProspects, canProspects, { to: prospectsLink(advisor, {}) })}
                  </td>
                  <td className="cell-stat cell-unat" data-label={t("advisorList.short.unattended")}>
                    {stat(unattended, canProspects, { to: prospectsLink(advisor, { filtro: "sin-atender" }), warn: late > 0 })}
                  </td>
                  <td className="cell-stat cell-over" data-label={t("advisorList.short.overdue")}>
                    {stat(overdue, canProspects, { to: prospectsLink(advisor, { filtro: "vencidos" }), warn: true })}
                  </td>
                  <td className="cell-stat cell-props" data-label={t("advisorList.short.properties")}>
                    {stat(properties, true)}
                  </td>
                  <td className="cell-stat cell-visits" data-label={t("advisorList.short.visitsMonth")}>
                    {stat(visitsMonth, canVisits)}
                  </td>
                  <td className="cell-stat cell-agenda" data-label={t("advisorList.short.agendaToday")}>
                    {stat(agendaToday, canAgenda)}
                  </td>
                  <td className="cell-badges">
                    <span className={`badge ${advisor.active !== false ? "badge-available" : "badge-sold"}`}>
                      {advisor.active !== false ? t("common.active") : t("common.inactive")}
                    </span>
                    <span className={`badge ${advisor.show_in_team !== false ? "badge-available" : "badge-sold"}`}>
                      {advisor.show_in_team !== false ? "En equipo" : "Oculto"}
                    </span>
                  </td>
                  <td className="admin-table__actions cell-actions">
                    <Link to={`/admin/asesores/${advisor.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(advisor.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="form-hint">{t("advisorList.note")}</p>
    </div>
  );
}
