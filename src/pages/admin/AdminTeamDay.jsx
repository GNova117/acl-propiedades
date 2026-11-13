import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { queries } from "../../lib/queries";
import { useQuery } from "../../lib/useQuery";
import { buildTeamDay } from "../../lib/teamDay";
import "./admin.css";
import "./AdminTeamDay.css";

const NONE = [];

// «Equipo hoy»: el resumen del día para la oficina. Por cada asesor, de un vistazo, lo que se le está quedando sin atender —prospectos
// entrantes sin atender, seguimientos vencidos, prospectos que nadie ha tocado en una semana— y lo del día (citas por atender, visitas
// por cerrar o confirmar), con la misma regla que cada uno ve en su «Mi día» (lib/teamDay.js). Cada número lleva a Prospectos ya
// filtrado, y «Reasignar…» abre ese filtro en modo «Seleccionar» para pasar los prospectos a otro asesor en lote. Aparte, lo que no tiene
// dueño: prospectos sin asesor (o de uno que ya no está activo) y solicitudes de visita del sitio que nadie ha tomado.
// Solo para quien ve todas las agendas (la oficina): RLS ya recorta lo demás.
export default function AdminTeamDay() {
  const { t, i18n } = useTranslation();
  const { advisorId, hasSection } = useAuth();
  const canAgenda = hasSection("agenda");
  const prospectsQ = useQuery(queries.prospects);
  const citasQ = useQuery(queries.citas, { enabled: canAgenda });
  const advisorsQ = useQuery(queries.advisors);
  const [now, setNow] = useState(() => new Date());

  // El resumen se recalcula cada minuto (las horas de las citas y «sin atender» avanzan solas).
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const day = useMemo(
    () => buildTeamDay({ prospects: prospectsQ.data ?? NONE, citas: citasQ.data ?? NONE, advisors: advisorsQ.data ?? NONE, now }),
    [prospectsQ.data, citasQ.data, advisorsQ.data, now]
  );

  if (advisorId != null) return <div className="empty-state">{t("team.officeOnly")}</div>;

  const loading = prospectsQ.loading || advisorsQ.loading;
  const error = prospectsQ.data ? "" : [prospectsQ, advisorsQ].find((q) => q.error)?.error.message || "";
  const dateTitle = now.toLocaleDateString(i18n.language === "en" ? "en-US" : "es-MX", { weekday: "long", day: "numeric", month: "long" });
  const link = (advisor, extra) => `/admin/prospectos?${new URLSearchParams({ asesor: advisor ? advisor.id : "ninguno", ...extra }).toString()}`;

  // Un número del renglón: lleva a Prospectos filtrado si hay algo y se sabe adónde; en cero queda tenue.
  const tile = (key, count, to, extra) => {
    const body = (
      <>
        <strong>{count}</strong>
        <span>{t(`team.tiles.${key}`)}</span>
        {extra && <span className="team-tile__extra">{extra}</span>}
      </>
    );
    const cls = `team-tile${count === 0 ? " is-zero" : ""}${to && count > 0 ? " is-link" : ""}`;
    return to && count > 0 ? (
      <Link key={key} to={to} className={cls} data-tile={key}>
        {body}
      </Link>
    ) : (
      <div key={key} className={cls} data-tile={key}>
        {body}
      </div>
    );
  };

  const card = (advisor, row, { unassigned = false } = {}) => {
    const urgent = row.late > 0;
    const state = row.attention === 0 ? "ok" : urgent ? "urgent" : "attention";
    const firstProblem = row.unattended > 0 ? "sin-atender" : row.overdue > 0 ? "vencidos" : "olvidados";
    return (
      <section key={advisor ? advisor.id : "none"} className={`card team-card team-card--${state}${unassigned ? " team-card--unassigned" : ""}`} data-advisor={advisor ? advisor.id : "ninguno"} aria-label={advisor ? advisor.name : t("team.unassigned.title")}>
        <div className="team-card__head">
          <div>
            <h2>{advisor ? advisor.name : t("team.unassigned.title")}</h2>
            {unassigned && <p className="form-hint">{t("team.unassigned.hint")}</p>}
          </div>
          <span className={`team-state team-state--${state}`}>{t(`team.state.${state}`)}</span>
        </div>
        <div className="team-card__tiles">
          {tile("unattended", row.unattended, link(advisor, { filtro: "sin-atender" }), urgent ? t("team.tiles.urgentSome", { count: row.late }) : "")}
          {tile("overdue", row.overdue, link(advisor, { filtro: "vencidos" }))}
          {tile("forgotten", row.forgotten, link(advisor, { filtro: "olvidados" }))}
          {tile("dueToday", row.dueToday)}
          {!unassigned && tile("agendaToday", row.agendaToday)}
          {!unassigned && tile("toClose", row.toClose)}
          {!unassigned && tile("toConfirm", row.toConfirm)}
        </div>
        <div className="team-card__actions">
          {row.open > 0 && (
            <Link to={link(advisor, {})} className="btn btn-outline btn-sm">
              {t("team.viewProspects", { count: row.open })}
            </Link>
          )}
          {row.attention > 0 && row.open > 0 && (
            <Link to={link(advisor, { filtro: firstProblem, seleccionar: "1" })} className="btn btn-outline btn-sm">
              {t("team.reassign")}
            </Link>
          )}
        </div>
      </section>
    );
  };

  const totalsItems = [
    ["unattended", day.totals.unattended],
    ["overdue", day.totals.overdue],
    ["forgotten", day.totals.forgotten],
    ["agendaToday", day.totals.agendaToday],
    ["toClose", day.totals.toClose],
  ];

  return (
    <div className="team-day">
      <div className="admin-header">
        <div>
          <h1>{t("team.title")}</h1>
          <p className="form-hint">
            {dateTitle} · {t("team.subtitle")}
          </p>
        </div>
        <div className="admin-header__actions">
          <Link to="/admin/prospectos" className="btn btn-outline">
            {t("myDay.allProspects")}
          </Link>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p className="form-hint">…</p>
      ) : (
        <>
          <ul className="team-totals" aria-label={t("team.totals")}>
            {totalsItems.map(([key, count]) => (
              <li key={key} className={count === 0 ? "is-zero" : ""} data-total={key}>
                <strong>{count}</strong>
                <span>{t(`team.tiles.${key}`)}</span>
              </li>
            ))}
          </ul>

          {day.requests > 0 && (
            <p className="team-requests" role="status">
              {t("team.requests", { count: day.requests })}{" "}
              <Link to="/admin/mi-dia">{t("team.requestsOpen")}</Link>
            </p>
          )}

          {day.rows.length === 0 && day.unassigned.open === 0 ? (
            <p className="form-hint">{t("team.empty")}</p>
          ) : (
            <div className="team-grid">
              {day.unassigned.open > 0 && card(null, day.unassigned, { unassigned: true })}
              {day.rows.map((row) => card(row.advisor, row))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
