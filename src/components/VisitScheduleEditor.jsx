import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { activeCitas } from "../lib/agendaCitas";
import {
  DEFAULT_VISIT_SETTINGS,
  SLOT_MINUTE_OPTIONS,
  WEEK_DISPLAY_ORDER,
  addDays,
  daysToWeekly,
  findScheduleIssues,
  generateSlots,
  mexicoParts,
  weeklyToDays,
} from "../lib/visitSlots";
import "./VisitScheduleEditor.css";

const NOTICE_OPTIONS = [0, 1, 2, 4, 12, 24, 48];
const HORIZON_OPTIONS = [7, 14, 21, 30, 60];
const DEFAULT_WINDOW = { start_time: "10:00", end_time: "18:00" };
const PREVIEW_DAYS = 14;

// Horario en que un asesor recibe visitas reservadas desde la ficha de una
// propiedad: interruptor general, duración de cada visita, anticipación,
// ventanas por día de la semana y días de descanso. El visitante solo ve los
// horarios libres que salen de aquí (ver lib/visitSlots.js y las funciones
// get_visit_slots / book_visit de supabase/schema.sql). Mientras el interruptor
// esté apagado, la ficha sigue con el formulario de siempre.
export default function VisitScheduleEditor({ advisorId }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState({ ...DEFAULT_VISIT_SETTINGS, enabled: false });
  const [days, setDays] = useState(() => weeklyToDays([]));
  const [timeOff, setTimeOff] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showIssues, setShowIssues] = useState(false);

  const applySchedule = (schedule) => {
    setSettings(schedule.settings);
    setDays(weeklyToDays(schedule.weekly));
    setTimeOff((schedule.timeOff || []).map((o) => ({ fecha_inicio: o.fecha_inicio, fecha_fin: o.fecha_fin, motivo: o.motivo || "" })));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([db.getAdvisorVisitSchedule(advisorId), db.getAgendaCitas().catch(() => [])])
      .then(([schedule, allCitas]) => {
        if (cancelled) return;
        applySchedule(schedule);
        setCitas(allCitas.filter((c) => c.advisor_id === advisorId));
      })
      .catch((err) => !cancelled && setError(err.message || t("visitSchedule.loadError")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [advisorId, t]);

  const weekly = useMemo(() => daysToWeekly(days), [days]);
  const issues = useMemo(() => findScheduleIssues({ weekly, timeOff }), [weekly, timeOff]);
  const issueFor = (weekday) => issues.find((i) => i.weekday === weekday)?.code;

  // Cuántos horarios vería un visitante en los próximos días con lo que hay en pantalla.
  const previewCount = useMemo(() => {
    if (!settings.enabled || issues.length > 0) return null;
    const today = mexicoParts().date;
    return generateSlots({
      settings,
      availability: weekly,
      timeOff,
      citas: activeCitas(citas),
      advisorId,
      from: today,
      to: addDays(today, PREVIEW_DAYS),
    }).length;
  }, [settings, weekly, timeOff, citas, advisorId, issues.length]);

  const touch = (fn) => (...args) => {
    setSaved(false);
    fn(...args);
  };

  const setSetting = (field, value) => touch(setSettings)((prev) => ({ ...prev, [field]: value }));
  const toggleDay = touch((weekday, on) => setDays((prev) => ({ ...prev, [weekday]: on ? [{ ...DEFAULT_WINDOW }] : [] })));
  const addWindow = touch((weekday) =>
    setDays((prev) => {
      const last = prev[weekday][prev[weekday].length - 1];
      const start = last ? last.end_time : DEFAULT_WINDOW.start_time;
      return { ...prev, [weekday]: [...prev[weekday], { start_time: start, end_time: start < "17:00" ? "18:00" : "20:00" }] };
    })
  );
  const editWindow = touch((weekday, index, field, value) =>
    setDays((prev) => ({ ...prev, [weekday]: prev[weekday].map((w, i) => (i === index ? { ...w, [field]: value } : w)) }))
  );
  const removeWindow = touch((weekday, index) =>
    setDays((prev) => ({ ...prev, [weekday]: prev[weekday].filter((_, i) => i !== index) }))
  );
  const copyMondayToWeekdays = touch(() =>
    setDays((prev) => ({ ...prev, 2: prev[1].map((w) => ({ ...w })), 3: prev[1].map((w) => ({ ...w })), 4: prev[1].map((w) => ({ ...w })), 5: prev[1].map((w) => ({ ...w })) }))
  );
  const addTimeOff = touch(() => setTimeOff((prev) => [...prev, { fecha_inicio: "", fecha_fin: "", motivo: "" }]));
  const editTimeOff = touch((index, field, value) =>
    setTimeOff((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)))
  );
  const removeTimeOff = touch((index) => setTimeOff((prev) => prev.filter((_, i) => i !== index)));

  const handleSave = async () => {
    setError("");
    setSaved(false);
    if (issues.length > 0) {
      setShowIssues(true);
      return;
    }
    setShowIssues(false);
    setSaving(true);
    try {
      const result = await db.saveAdvisorVisitSchedule(advisorId, { settings, weekly, timeOff });
      applySchedule(result);
      setSaved(true);
    } catch (err) {
      setError(err.message || t("visitSchedule.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
  // 2024-01-0X es lunes…domingo; sirve para sacar el nombre del día en el idioma activo.
  const weekdayName = (weekday) => new Date(Date.UTC(2024, 0, weekday === 0 ? 7 : weekday, 12)).toLocaleDateString(locale, { weekday: "long", timeZone: "UTC" });
  const hasWindows = weekly.length > 0;

  if (loading) return <div className="card visit-schedule">{t("common.loading")}</div>;

  return (
    <section className="card visit-schedule" aria-labelledby="visit-schedule-title">
      <h2 id="visit-schedule-title">{t("visitSchedule.title")}</h2>
      <p className="form-hint">{t("visitSchedule.intro")}</p>

      <label className="visit-schedule__switch">
        <input type="checkbox" checked={settings.enabled} onChange={(e) => setSetting("enabled", e.target.checked)} />
        <span>{t("visitSchedule.enable")}</span>
      </label>
      {!settings.enabled && <p className="form-hint">{t("visitSchedule.disabledHint")}</p>}

      <div className={settings.enabled ? "" : "visit-schedule__body--off"}>
        <div className="form-row visit-schedule__settings">
          <div className="form-field">
            <label htmlFor="vs-slot">{t("visitSchedule.slotMinutes")}</label>
            <select id="vs-slot" value={settings.slot_minutes} onChange={(e) => setSetting("slot_minutes", Number(e.target.value))}>
              {SLOT_MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {t("visitSchedule.minutes", { count: m })}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="vs-notice">{t("visitSchedule.minNotice")}</label>
            <select id="vs-notice" value={settings.min_notice_hours} onChange={(e) => setSetting("min_notice_hours", Number(e.target.value))}>
              {NOTICE_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h === 0 ? t("visitSchedule.noNotice") : t("visitSchedule.hours", { count: h })}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="vs-horizon">{t("visitSchedule.horizon")}</label>
            <select id="vs-horizon" value={settings.horizon_days} onChange={(e) => setSetting("horizon_days", Number(e.target.value))}>
              {HORIZON_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t("visitSchedule.days", { count: d })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h3>{t("visitSchedule.weekTitle")}</h3>
        <ul className="visit-schedule__week">
          {WEEK_DISPLAY_ORDER.map((weekday) => {
            const windows = days[weekday];
            const issue = showIssues ? issueFor(weekday) : null;
            return (
              <li key={weekday} className="visit-schedule__day">
                <label className="visit-schedule__day-name">
                  <input type="checkbox" checked={windows.length > 0} onChange={(e) => toggleDay(weekday, e.target.checked)} />
                  <span>{weekdayName(weekday)}</span>
                </label>
                <div className="visit-schedule__windows">
                  {windows.length === 0 ? (
                    <span className="form-hint">{t("visitSchedule.noService")}</span>
                  ) : (
                    windows.map((w, index) => (
                      <div key={index} className="visit-schedule__window">
                        <input
                          type="time"
                          value={w.start_time}
                          aria-label={t("visitSchedule.from", { day: weekdayName(weekday) })}
                          onChange={(e) => editWindow(weekday, index, "start_time", e.target.value)}
                        />
                        <span aria-hidden="true">–</span>
                        <input
                          type="time"
                          value={w.end_time}
                          aria-label={t("visitSchedule.to", { day: weekdayName(weekday) })}
                          onChange={(e) => editWindow(weekday, index, "end_time", e.target.value)}
                        />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => removeWindow(weekday, index)} aria-label={t("visitSchedule.removeWindow")}>
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                  {windows.length > 0 && (
                    <button type="button" className="btn btn-outline btn-sm visit-schedule__add" onClick={() => addWindow(weekday)}>
                      {t("visitSchedule.addWindow")}
                    </button>
                  )}
                  {issue && <span className="form-error">{t(`visitSchedule.issues.${issue}`)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn-outline btn-sm" onClick={copyMondayToWeekdays} disabled={days[1].length === 0}>
          {t("visitSchedule.copyMonday")}
        </button>

        <h3>{t("visitSchedule.timeOffTitle")}</h3>
        <p className="form-hint">{t("visitSchedule.timeOffHint")}</p>
        {timeOff.map((o, index) => (
          <div key={index} className="visit-schedule__off">
            <input type="date" value={o.fecha_inicio} aria-label={t("visitSchedule.offFrom")} onChange={(e) => editTimeOff(index, "fecha_inicio", e.target.value)} />
            <span aria-hidden="true">–</span>
            <input type="date" value={o.fecha_fin} min={o.fecha_inicio || undefined} aria-label={t("visitSchedule.offTo")} onChange={(e) => editTimeOff(index, "fecha_fin", e.target.value)} />
            <input
              type="text"
              value={o.motivo}
              maxLength={80}
              placeholder={t("visitSchedule.offReason")}
              aria-label={t("visitSchedule.offReason")}
              onChange={(e) => editTimeOff(index, "motivo", e.target.value)}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => removeTimeOff(index)} aria-label={t("visitSchedule.removeOff")}>
              ✕
            </button>
          </div>
        ))}
        {showIssues && issues.some((i) => i.code === "invalid_time_off") && <p className="form-error">{t("visitSchedule.issues.invalid_time_off")}</p>}
        <button type="button" className="btn btn-outline btn-sm" onClick={addTimeOff}>
          {t("visitSchedule.addTimeOff")}
        </button>
      </div>

      {settings.enabled && !hasWindows && <p className="form-error">{t("visitSchedule.enabledWithoutWindows")}</p>}
      {previewCount != null && hasWindows && (
        <p className="visit-schedule__preview" role="status">
          {t("visitSchedule.preview", { count: previewCount, days: PREVIEW_DAYS })}
        </p>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="admin-form__actions">
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" /> : null}
          {t("common.save")}
        </button>
        {saved && <span className="form-hint">{t("visitSchedule.saved")}</span>}
      </div>
    </section>
  );
}
