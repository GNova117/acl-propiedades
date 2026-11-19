import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { citaStatus, isOpenRequest } from "../lib/agendaCitas";
import { hourRange, layoutDay } from "../lib/agendaWeek";
import "./AgendaTimeGrid.css";

const HOUR_PX = 48;
const pad2 = (n) => String(n).padStart(2, "0");

// Cuadrícula por horas de la Agenda: una columna por día (semana: 7; día: 1). Las citas se colocan por hora y
// duración y las que se traslapan quedan lado a lado. `citasByDate`: Map "YYYY-MM-DD" → citas de ese día.
// `onOpenRequest(cita)`: las solicitudes sin asesor se atienden en la lista (no tienen ficha propia).
export default function AgendaTimeGrid({ days, citasByDate, todayIso, dayLabel, contactName, onOpenRequest }) {
  const { t } = useTranslation();
  const all = days.flatMap((iso) => citasByDate.get(iso) || []);
  const { start, end } = hourRange(all);
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const layouts = days.map((iso) => layoutDay(citasByDate.get(iso) || []));
  const anyAllDay = layouts.some((l) => l.allDay.length > 0);

  const card = (cita, style) => {
    const status = citaStatus(cita);
    const open = isOpenRequest(cita);
    const className = `agenda-grid__cita agenda-grid__cita--${status}${open ? " agenda-grid__cita--request" : ""}`;
    const body = (
      <>
        <strong>{cita.hora ? `${String(cita.hora).slice(0, 5)} ` : ""}</strong>
        {cita.titulo}
        {contactName(cita) && <span className="agenda-grid__who">{contactName(cita)}</span>}
      </>
    );
    return open ? (
      <button key={cita.id} type="button" className={className} style={style} title={cita.titulo} onClick={() => onOpenRequest(cita)}>
        {body}
      </button>
    ) : (
      <Link key={cita.id} to={`/admin/agenda/${cita.id}`} className={className} style={style} title={cita.titulo}>
        {body}
      </Link>
    );
  };

  return (
    <div className="agenda-grid" style={{ "--agenda-cols": days.length }} role="group" aria-label={t("agenda.timeGrid")}>
      <div className="agenda-grid__head">
        <span />
        {days.map((iso) => (
          <span key={iso} className={`agenda-grid__day${iso === todayIso ? " agenda-grid__day--today" : ""}`}>
            {dayLabel(iso)}
          </span>
        ))}
      </div>

      {anyAllDay && (
        <div className="agenda-grid__allday">
          <span className="agenda-grid__axis">{t("agenda.allDay")}</span>
          {layouts.map((l, i) => (
            <div key={days[i]} className="agenda-grid__allday-cell">
              {l.allDay.map((cita) => card(cita, undefined))}
            </div>
          ))}
        </div>
      )}

      <div className="agenda-grid__body" style={{ height: hours.length * HOUR_PX }}>
        <div className="agenda-grid__axis-col">
          {hours.map((h) => (
            <span key={h} className="agenda-grid__axis" style={{ height: HOUR_PX }}>
              {pad2(h)}:00
            </span>
          ))}
        </div>
        {layouts.map((l, i) => (
          <div key={days[i]} className={`agenda-grid__col${days[i] === todayIso ? " agenda-grid__col--today" : ""}`}>
            {hours.map((h) => (
              <span key={h} className="agenda-grid__line" style={{ top: (h - start) * HOUR_PX }} aria-hidden="true" />
            ))}
            {l.timed.map(({ cita, startMin, endMin, column, columns }) =>
              card(cita, {
                top: ((startMin - start * 60) / 60) * HOUR_PX,
                height: Math.max(22, ((endMin - startMin) / 60) * HOUR_PX - 2),
                left: `${(column / columns) * 100}%`,
                width: `calc(${100 / columns}% - 2px)`,
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
