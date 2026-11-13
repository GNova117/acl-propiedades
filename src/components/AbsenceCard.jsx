import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { MAX_REASON, absenceFor, todayISO, upcomingAbsences, validateAbsence } from "../lib/absences";
import "./AbsenceCard.css";

const EMPTY = { fecha_inicio: "", fecha_fin: "", motivo: "" };

// «Ausencias y vacaciones» (Mi perfil del asesor y edición de un asesor en la oficina): cuándo no está. Son los días de descanso de
// su horario de visitas (advisor_time_off), con una tarjeta propia para que no dependan de que la reserva en línea esté activa:
// aun sin horarios en línea, una ausencia sirve para asignar prospectos nuevos a otro asesor y para que la oficina lo vea en
// «Equipo hoy». Cada cambio se guarda al momento (no hay botón «Guardar»); al guardar se descartan las que ya terminaron.
export default function AbsenceCard({ advisorId }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    db.getAdvisorTimeOff(advisorId)
      .then((list) => !cancelled && setRows(list))
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setError(err.message || t("absences.errors.load"));
      });
    return () => {
      cancelled = true;
    };
  }, [advisorId, t]);

  const today = todayISO();
  const upcoming = useMemo(() => upcomingAbsences(rows || [], today), [rows, today]);
  const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const persist = async (next) => {
    setSaving(true);
    setError("");
    try {
      setRows(await db.saveAdvisorTimeOff(advisorId, upcomingAbsences(next, today)));
      return true;
    } catch (err) {
      setError(err.message || t("absences.errors.save"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const found = validateAbsence(form, today);
    if (found.dates) {
      setError(t(found.dates));
      return;
    }
    if (await persist([...(rows || []), form])) setForm(EMPTY);
  };

  if (rows === null) return <div className="card absence-card">{t("common.loading")}</div>;

  return (
    <section className="card absence-card" aria-labelledby={`absences-title-${advisorId}`}>
      <h2 id={`absences-title-${advisorId}`}>{t("absences.title")}</h2>
      <p className="form-hint">{t("absences.intro")}</p>

      {upcoming.length === 0 ? (
        <p className="form-hint absence-card__empty">{t("absences.empty")}</p>
      ) : (
        <ul className="absence-card__list">
          {upcoming.map((row, index) => {
            const now = absenceFor([{ ...row, advisor_id: advisorId }], advisorId, today);
            return (
              <li key={`${row.fecha_inicio}-${row.fecha_fin}-${index}`} className="absence-card__item">
                <div>
                  <strong>{row.fecha_inicio === row.fecha_fin ? day(row.fecha_inicio) : t("absences.range", { from: day(row.fecha_inicio), to: day(row.fecha_fin) })}</strong>
                  {now && <span className="absence-card__now">{t("absences.now")}</span>}
                  {row.motivo && <span className="form-hint absence-card__reason">{row.motivo}</span>}
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={saving}
                  onClick={() => persist(rows.filter((r) => r !== row))}
                  aria-label={t("absences.remove", { from: day(row.fecha_inicio), to: day(row.fecha_fin) })}
                >
                  {t("absences.removeShort")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form className="absence-card__form" onSubmit={add} noValidate>
        <div className="form-field">
          <label htmlFor={`abs-from-${advisorId}`}>{t("absences.from")}</label>
          <input id={`abs-from-${advisorId}`} type="date" value={form.fecha_inicio} min={today} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value, fecha_fin: f.fecha_fin && f.fecha_fin < e.target.value ? e.target.value : f.fecha_fin }))} />
        </div>
        <div className="form-field">
          <label htmlFor={`abs-to-${advisorId}`}>{t("absences.to")}</label>
          <input id={`abs-to-${advisorId}`} type="date" value={form.fecha_fin} min={form.fecha_inicio || today} onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))} />
        </div>
        <div className="form-field absence-card__reason-field">
          <label htmlFor={`abs-reason-${advisorId}`}>{t("absences.reason")}</label>
          <input id={`abs-reason-${advisorId}`} type="text" maxLength={MAX_REASON} value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} placeholder={t("absences.reasonPlaceholder")} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="spinner" /> : null}
          {t("absences.add")}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
