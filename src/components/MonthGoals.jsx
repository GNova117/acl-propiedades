import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { useAuth } from "../context/AuthContext";
import { GOAL_METRICS, MAX_GOAL, countMonth, formToGoalColumns, goalProgress, goalsToForm, monthStartISO, validateGoals } from "../lib/goals";
import "./MonthGoals.css";

// Apartado que hace falta para poder medir cada cosa (y por lo tanto para
// ponerle meta): sin él la tabla no se puede leer y el avance saldría en cero.
const SECTION_FOR = { contacts: "prospectos", newProspects: "prospectos", visits: "visitas", sales: "reportes" };

const STATUS_ICON = { done: "✓", ahead: "▲", onTrack: "●", behind: "▼" };

// "Mi mes" (Mi día): la meta mensual del asesor y cuánto lleva. Solo para quien
// tiene un login vinculado a un asesor (la meta es suya; la oficina no la tiene).
// El avance sale de datos que ya existen: contactos, visitas, prospectos nuevos y,
// con el apartado de reportes, ventas. El estado ("vas por delante", "te conviene
// acelerar") va en texto y con símbolo, no solo con el color de la barra.
export default function MonthGoals({ advisorId }) {
  const { t, i18n } = useTranslation();
  const { hasSection } = useAuth();
  // Clave en texto para que la lista solo cambie si cambian los permisos, no en cada render.
  const metricsKey = GOAL_METRICS.filter((m) => hasSection(SECTION_FOR[m])).join(",");
  const metrics = useMemo(() => (metricsKey ? metricsKey.split(",") : []), [metricsKey]);
  const [goals, setGoals] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goalsToForm(null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    const safe = (load, fallback) => load().catch(() => fallback);
    Promise.all([
      safe(() => db.getAdvisorGoals(advisorId), null),
      metrics.includes("contacts") ? safe(() => db.countProspectContactsSince(monthStartISO(now)), 0) : 0,
      metrics.includes("visits") ? safe(() => db.getVisits(), []) : [],
      metrics.includes("newProspects") ? safe(() => db.getProspects(), []) : [],
      metrics.includes("sales") ? safe(() => db.getVentas(), []) : [],
    ]).then(([goalRow, contacts, visits, prospects, ventas]) => {
      if (cancelled) return;
      setGoals(goalRow);
      setCounts(countMonth({ contacts, visits, prospects, ventas }, advisorId, now));
      setForm(goalsToForm(goalRow));
      // Sin ninguna meta todavía: se abre el formulario para fijarla.
      setEditing(!goalProgress(goalRow, {}, now, { metrics }).length);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [advisorId, metrics, now]);

  const rows = useMemo(() => (counts ? goalProgress(goals, counts, now, { metrics }) : []), [goals, counts, now, metrics]);

  const save = async (e) => {
    e.preventDefault();
    const found = validateGoals(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError("");
    try {
      // Una métrica que este rol no puede medir no se toca: se conserva lo ya guardado.
      const keep = goalsToForm(goals);
      const columns = formToGoalColumns(Object.fromEntries(GOAL_METRICS.map((m) => [m, metrics.includes(m) ? form[m] : keep[m]])));
      const saved = await db.saveAdvisorGoals(advisorId, columns);
      setGoals(saved);
      setEditing(false);
    } catch (err) {
      setSaveError(err?.code === "42P01" || /advisor_goals/.test(err?.message || "") ? t("goals.errors.noTable") : err?.message || t("goals.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || metrics.length === 0) return null;

  const monthName = now.toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { month: "long" });

  return (
    <section className="month-goals card" aria-label={t("goals.title")}>
      <div className="month-goals__head">
        <h2>{t("goals.title", { month: monthName })}</h2>
        {!editing && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
            {t("goals.edit")}
          </button>
        )}
      </div>

      {!editing && (
        <ul className="month-goals__list">
          {rows.map((r) => (
            <li key={r.key} className="month-goals__row">
              <div className="month-goals__line">
                <span>{t(`goals.metrics.${r.key}`)}</span>
                <strong>
                  {r.actual} / {r.target}
                </strong>
              </div>
              <div className={`month-goals__bar month-goals__bar--${r.status}`} role="progressbar" aria-valuemin={0} aria-valuemax={r.target} aria-valuenow={Math.min(r.actual, r.target)} aria-label={t(`goals.metrics.${r.key}`)}>
                <span style={{ width: `${r.pct}%` }} />
              </div>
              <p className="month-goals__status">
                <span aria-hidden="true">{STATUS_ICON[r.status]}</span> {t(`goals.status.${r.status}`)}
                {r.remaining > 0 && <> · {t("goals.remaining", { count: r.remaining })} · {t("goals.perDay", { count: r.perDay })}</>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <form onSubmit={save} noValidate>
          <p className="form-hint">{t("goals.hint")}</p>
          <div className="month-goals__fields">
            {metrics.map((m) => (
              <div className="form-field" key={m}>
                <label htmlFor={`goal-${m}`}>{t(`goals.metrics.${m}`)}</label>
                <input id={`goal-${m}`} type="number" inputMode="numeric" min="0" max={MAX_GOAL} step="1" value={form[m]} onChange={(e) => setForm((prev) => ({ ...prev, [m]: e.target.value }))} placeholder={t("goals.noGoal")} />
                {errors[m] && <span className="form-error">{t(errors[m])}</span>}
              </div>
            ))}
          </div>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="month-goals__actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {t("goals.save")}
            </button>
            {rows.length > 0 && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setForm(goalsToForm(goals));
                  setErrors({});
                  setSaveError("");
                  setEditing(false);
                }}
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
