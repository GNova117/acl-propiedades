import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { trackEvent } from "../lib/analytics";
import { citaToIcs, downloadIcs, mapsUrl } from "../lib/calendarEvent";
import { OFFICE_WHATSAPP } from "../lib/office";
import { bookingFieldErrors, groupSlotsByDate } from "../lib/visitSlots";
import { bookingErrorField, bookingErrorKey, bookingToCalendarEvent, formatSlotDay, formatSlotTime, slotDayParts } from "../lib/visitBookingUi";

const EMPTY = { name: "", email: "", phone: "", note: "", empresa: "" };

// Reserva de visita con horarios reales: el visitante elige un día y una hora
// libres del asesor, deja sus datos y la visita queda agendada al momento (ver
// book_visit en supabase/schema.sql). `slots` son los horarios libres que ya
// trajo ScheduleVisitCard; si el horario elegido se ocupa mientras tanto, se
// avisa y se piden de nuevo (`onReload`).
export default function VisitBooking({ property, slots, onReload, onRequestInstead }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";

  const days = useMemo(() => groupSlotsByDate(slots), [slots]);
  const [pickedDate, setPickedDate] = useState("");
  const [pickedTime, setPickedTime] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending
  const [booked, setBooked] = useState(null);

  // Lo elegido solo vale si sigue existiendo en la lista (puede cambiar al recargar).
  const activeDay = days.find((d) => d.fecha === pickedDate) || days[0];
  const activeDate = activeDay?.fecha || "";
  const activeTime = activeDay?.horas.includes(pickedTime) ? pickedTime : "";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const pickDate = (fecha) => {
    setPickedDate(fecha);
    setPickedTime("");
    setFormError("");
  };

  const pickTime = (hora) => {
    setPickedTime(hora);
    setFormError("");
    trackEvent("visit_slot_selected", { property_id: property.id });
  };

  const fieldMessage = (field, code) => {
    if (field === "email") return code === "invalid_email" && form.email.trim() ? t("contact.invalidEmail") : t("contact.required");
    if (field === "name") return t("contact.required");
    return t(`scheduleVisit.booking.errors.${field === "phone" ? "invalidPhone" : "invalidNote"}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!activeTime) {
      setFormError(t("scheduleVisit.booking.pickSlot"));
      return;
    }
    const codes = bookingFieldErrors(form);
    const fields = Object.keys(codes);
    if (fields.length > 0) {
      setErrors(Object.fromEntries(fields.map((field) => [field, fieldMessage(field, codes[field])])));
      return;
    }
    // Campo trampa para bots (invisible para personas): no se manda nada.
    if (form.empresa.trim()) {
      setFormError(t("scheduleVisit.booking.errors.generic"));
      return;
    }

    setStatus("sending");
    try {
      const result = await db.bookVisit({
        propertyId: property.id,
        fecha: activeDate,
        hora: activeTime,
        name: form.name,
        email: form.email,
        phone: form.phone,
        note: form.note,
      });
      if (result?.ok) {
        trackEvent("visit_booked", { property_id: property.id, property_type: property.type });
        setBooked({ ...result, note: form.note });
        return;
      }
      const code = result?.error;
      const field = bookingErrorField(code);
      if (field) {
        setErrors({ [field]: fieldMessage(field, code) });
      } else {
        setFormError(t(`scheduleVisit.booking.errors.${bookingErrorKey(code)}`));
        if (code === "slot_unavailable" || code === "invalid_slot") {
          setPickedTime("");
          onReload?.();
        }
      }
    } catch {
      setFormError(t("scheduleVisit.booking.errors.generic"));
    } finally {
      setStatus("idle");
    }
  };

  if (booked) {
    const label = booked.property?.code ? `${booked.property.title.trim()} (${booked.property.code})` : booked.property?.title?.trim() || property.title.trim();
    const when = `${formatSlotDay(booked.fecha, locale)} · ${formatSlotTime(booked.hora, locale)}`;
    const addToCalendar = () => {
      const event = bookingToCalendarEvent(booked, { titlePrefix: t("scheduleVisit.booking.eventPrefix"), note: booked.note });
      downloadIcs(`visita-${booked.fecha}.ics`, citaToIcs(event, { advisorName: booked.advisor?.name || "" }));
    };
    // El WhatsApp es el de la oficina: la ficha no publica los datos de contacto de cada asesor.
    const whatsappText = t("scheduleVisit.booking.whatsappText", { property: label, when, name: form.name.trim() });
    return (
      <div className="visit-booking__done" role="status">
        <h4 className="visit-booking__done-title">{t("scheduleVisit.booking.doneTitle")}</h4>
        <p className="visit-booking__when">{when}</p>
        <p className="visit-booking__done-line">{label}</p>
        {booked.advisor?.name && <p className="form-hint">{t("scheduleVisit.booking.withAdvisor", { name: booked.advisor.name })}</p>}
        {booked.property?.address && <p className="form-hint">📍 {booked.property.address}</p>}
        <div className="visit-booking__done-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={addToCalendar}>
            {t("scheduleVisit.booking.addToCalendar")}
          </button>
          {booked.property?.address && (
            <a className="btn btn-outline btn-block" href={mapsUrl(booked.property.address)} target="_blank" rel="noopener noreferrer">
              {t("scheduleVisit.booking.directions")}
            </a>
          )}
          <a className="btn btn-outline btn-block" href={`https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer">
            {t("scheduleVisit.booking.whatsapp")}
          </a>
        </div>
        <p className="form-hint">{t("scheduleVisit.booking.changeHint")}</p>
      </div>
    );
  }

  return (
    <form className="visit-booking" onSubmit={handleSubmit} noValidate>
      <h4 className="visit-booking__step">{t("scheduleVisit.booking.chooseDay")}</h4>
      <div className="visit-booking__days" role="group" aria-label={t("scheduleVisit.booking.chooseDay")}>
        {days.map(({ fecha }) => {
          const parts = slotDayParts(fecha, locale);
          const selected = fecha === activeDate;
          return (
            <button
              key={fecha}
              type="button"
              className={`visit-booking__day${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              aria-label={formatSlotDay(fecha, locale)}
              onClick={() => pickDate(fecha)}
            >
              <span className="visit-booking__weekday">{parts.weekday}</span>
              <strong>{parts.day}</strong>
              <span className="visit-booking__month">{parts.month}</span>
            </button>
          );
        })}
      </div>

      <h4 className="visit-booking__step">{t("scheduleVisit.booking.chooseTime")}</h4>
      <div className="visit-booking__times" role="group" aria-label={t("scheduleVisit.booking.chooseTime")}>
        {activeDay?.horas.map((hora) => {
          const selected = hora === activeTime;
          return (
            <button key={hora} type="button" className={`visit-booking__time${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={() => pickTime(hora)}>
              {formatSlotTime(hora, locale)}
            </button>
          );
        })}
      </div>

      {activeTime && (
        <p className="visit-booking__summary" role="status">
          {t("scheduleVisit.booking.selected", { when: `${formatSlotDay(activeDate, locale)} · ${formatSlotTime(activeTime, locale)}` })}
        </p>
      )}

      <h4 className="visit-booking__step">{t("scheduleVisit.booking.yourData")}</h4>

      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
        <label htmlFor="booking-empresa">Empresa</label>
        <input id="booking-empresa" name="empresa" value={form.empresa} onChange={handleChange} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="form-field">
        <label htmlFor="booking-name">{t("contact.name")}</label>
        <input id="booking-name" name="name" value={form.name} onChange={handleChange} autoComplete="name" aria-invalid={Boolean(errors.name)} />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="booking-email">{t("contact.email")}</label>
          <input id="booking-email" name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" aria-invalid={Boolean(errors.email)} />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="booking-phone">{t("contact.phone")}</label>
          <input id="booking-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
          {errors.phone && <span className="form-error">{errors.phone}</span>}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="booking-note">{t("scheduleVisit.note")}</label>
        <textarea id="booking-note" name="note" rows={2} value={form.note} onChange={handleChange} placeholder={t("scheduleVisit.booking.notePlaceholder")} aria-invalid={Boolean(errors.note)} />
        {errors.note && <span className="form-error">{errors.note}</span>}
      </div>

      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
        {status === "sending" ? <span className="spinner" /> : null}
        {status === "sending" ? t("scheduleVisit.booking.confirming") : t("scheduleVisit.booking.confirm")}
      </button>

      <p className="visit-booking__alt">
        <button type="button" className="visit-booking__link" onClick={onRequestInstead}>
          {t("scheduleVisit.booking.requestInstead")}
        </button>
      </p>
    </form>
  );
}
