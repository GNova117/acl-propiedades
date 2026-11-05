import { useTranslation } from "react-i18next";
import { formatSlotDay, formatSlotTime, slotDayParts } from "../lib/visitBookingUi";
import "./VisitSlotPicker.css";

// Selector de día (franja desplazable, solo días con horarios) y hora. Lo usan
// la reserva de la ficha (VisitBooking) y la página de reprogramar (/visita/:token).
export default function VisitSlotPicker({ selection, locale }) {
  const { t } = useTranslation();
  const { days, activeDay, activeDate, activeTime, pickDate, pickTime } = selection;

  return (
    <>
      <h4 className="visit-slots__step">{t("scheduleVisit.booking.chooseDay")}</h4>
      <div className="visit-slots__days" role="group" aria-label={t("scheduleVisit.booking.chooseDay")}>
        {days.map(({ fecha }) => {
          const parts = slotDayParts(fecha, locale);
          const selected = fecha === activeDate;
          return (
            <button
              key={fecha}
              type="button"
              className={`visit-slots__day${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              aria-label={formatSlotDay(fecha, locale)}
              onClick={() => pickDate(fecha)}
            >
              <span className="visit-slots__weekday">{parts.weekday}</span>
              <strong>{parts.day}</strong>
              <span className="visit-slots__month">{parts.month}</span>
            </button>
          );
        })}
      </div>

      <h4 className="visit-slots__step">{t("scheduleVisit.booking.chooseTime")}</h4>
      <div className="visit-slots__times" role="group" aria-label={t("scheduleVisit.booking.chooseTime")}>
        {activeDay?.horas.map((hora) => {
          const selected = hora === activeTime;
          return (
            <button key={hora} type="button" className={`visit-slots__time${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={() => pickTime(hora)}>
              {formatSlotTime(hora, locale)}
            </button>
          );
        })}
      </div>
    </>
  );
}
