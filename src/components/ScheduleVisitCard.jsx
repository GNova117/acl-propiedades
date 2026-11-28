import { useCallback, useEffect, useState } from "react";
import { errorId, fieldErrorProps, focusFirstError } from "../lib/formErrors";
import { saveContact, withRemembered } from "../lib/rememberedContact";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { trackConversion } from "../lib/conversions";
import { mexicoParts, REQUEST_TIME_OPTIONS, requestSlotError } from "../lib/visitSlots";
import { bookingErrorKey, formatSlotDay, formatSlotTime } from "../lib/visitBookingUi";
import { OPEN_SCHEDULE_EVENT, SCHEDULE_TARGET_ID } from "./MobileContactBar";
import VisitBooking from "./VisitBooking";
import "./ScheduleVisitCard.css";
import { lastSubmitAt, markSubmitted } from "../lib/rateLimitStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initialForm = { name: "", email: "", phone: "", date: "", time: "", note: "", empresa: "" };

// La tarjeta tiene dos modos. Si algún asesor de la propiedad activó la reserva en
// línea y tiene horarios libres, el visitante elige uno (viendo qué asesores están
// libres a esa hora) y la visita queda agendada al momento (VisitBooking). Si no
// hay horarios — o ninguno le acomoda —, deja una SOLICITUD con el día y la hora
// que prefiere (VisitRequestForm): queda en la Agenda de TODOS los asesores, sin
// asesor, hasta que uno la toma y le confirma por correo (request_visit /
// claim_visit_request en supabase/schema.sql).
//
// Compatibilidad: si request_visit todavía no está en la base (el SQL se aplica antes
// que el sitio, pero por si acaso), la solicitud cae al camino anterior — un
// contact_message con la fecha dentro del texto — para no perder nunca el contacto.
// Llave propia: antes compartía la de Contacto y mandar uno bloqueaba al otro 60 s.
const RATE_LIMIT_KEY = "acl_visit_last_submit";
const RATE_LIMIT_MS = 60_000;

function buildVisitMessage(property, { date, time, note }) {
  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const label = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
  let message = `Solicitud de visita — ${label}.\nFecha preferida: ${dateLabel}`;
  if (time) message += ` a las ${time}`;
  if (note.trim()) message += `\nNota: ${note.trim()}`;
  return message;
}

function VisitRequestForm({ property, onBack, noSlots }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
  const [form, setForm] = useState(() => withRemembered(initialForm));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(null);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.email.trim()) next.email = t("contact.required");
    else if (!EMAIL_RE.test(form.email)) next.email = t("contact.invalidEmail");
    if (!form.phone.trim()) next.phone = t("contact.required");
    if (!form.date) next.date = t("contact.required");
    if (!form.time) next.time = t("contact.required");
    setErrors(next);
    focusFirstError(next, ["name", "email", "phone", "date", "time"], { name: "visit-name", email: "visit-email", phone: "visit-phone", date: "visit-date", time: "visit-time" });
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    if (requestSlotError(form.date, form.time)) {
      setErrors({ date: t("scheduleVisit.request.invalidSlot") });
      return;
    }

    if (form.empresa.trim()) {
      setStatus("success");
      setForm(initialForm);
      return;
    }

    const lastSubmit = lastSubmitAt(RATE_LIMIT_KEY);
    if (Date.now() - lastSubmit < RATE_LIMIT_MS) {
      setStatus("rateLimited");
      return;
    }

    setStatus("sending");
    try {
      // Solicitud sin asesor: queda en la Agenda de todos hasta que alguien la toma.
      let result = null;
      try {
        result = await db.requestVisit({ propertyId: property.id, fecha: form.date, hora: form.time, name: form.name, email: form.email, phone: form.phone, note: form.note });
      } catch {
        result = null; // request_visit aún no está en la base: se usa el camino anterior (abajo).
      }
      if (result?.ok) {
        markSubmitted(RATE_LIMIT_KEY);
        saveContact(form);
        trackConversion("visit_requested", { property_id: property.id, property_type: property.type });
        setDone({ ...result });
        setForm(initialForm);
        setStatus("idle");
        return;
      }
      if (result?.error) {
        if (result.error === "invalid_slot") setErrors({ date: t("scheduleVisit.request.invalidSlot") });
        else setFormError(t(`scheduleVisit.booking.errors.${bookingErrorKey(result.error)}`));
        setStatus("idle");
        return;
      }
      await db.submitContactMessage({
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: buildVisitMessage(property, form),
        // Igual que la tarjeta de contacto: deja la solicitud ligada a la
        // propiedad para que llegue al asesor que la tiene asignada.
        property_id: property.id,
      });
      markSubmitted(RATE_LIMIT_KEY);
        saveContact(form);
      setStatus("success");
      setForm(initialForm);
    } catch {
      setStatus("error");
    }
  };

  if (done) {
    const when = `${formatSlotDay(done.fecha, locale)} · ${formatSlotTime(done.hora, locale)}`;
    return (
      <div className="visit-booking__done" role="status">
        <h4 className="visit-booking__done-title">{t("scheduleVisit.request.doneTitle")}</h4>
        <p className="visit-booking__done-line">{t("scheduleVisit.request.doneBody", { when })}</p>
        <div className="visit-booking__done-actions">
          <Link className="btn btn-primary btn-block" to={`/visita/${done.token}`}>
            {t("scheduleVisit.request.manage")}
          </Link>
          <button type="button" className="btn btn-outline btn-block" onClick={() => { setDone(null); setForm(withRemembered(initialForm)); }}>
            {t("scheduleVisit.booking.another")}
          </button>
        </div>
      </div>
    );
  }

  if (status === "success") return <p className="form-hint text-success">{t("scheduleVisit.success")}</p>;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {onBack && (
        <p className="visit-booking__alt">
          <button type="button" className="visit-booking__link" onClick={onBack}>
            {t("scheduleVisit.booking.backToSlots")}
          </button>
        </p>
      )}
      <p className="form-hint">{t(noSlots ? "scheduleVisit.request.noSlots" : "scheduleVisit.request.intro")}</p>
      <div aria-hidden="true" className="hp-field">
        <label htmlFor="visit-empresa">Empresa</label>
        <input id="visit-empresa" name="empresa" value={form.empresa} onChange={handleChange} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="form-field">
        <label htmlFor="visit-name">{t("contact.name")}</label>
        <input id="visit-name" name="name" autoComplete="name" value={form.name} onChange={handleChange} {...fieldErrorProps("visit-name", errors.name)} />
        {errors.name && <span id={errorId("visit-name")} className="form-error">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="visit-email">{t("contact.email")}</label>
          <input id="visit-email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} {...fieldErrorProps("visit-email", errors.email)} />
          {errors.email && <span id={errorId("visit-email")} className="form-error">{errors.email}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="visit-phone">{t("contact.phone")}</label>
          <input id="visit-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={handleChange} {...fieldErrorProps("visit-phone", errors.phone)} />
          {errors.phone && <span id={errorId("visit-phone")} className="form-error">{errors.phone}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="visit-date">{t("scheduleVisit.date")}</label>
          <input
            id="visit-date"
            name="date"
            type="date"
            min={mexicoParts().date}
            value={form.date}
            onChange={handleChange}
            {...fieldErrorProps("visit-date", errors.date)}
          />
          {errors.date && <span id={errorId("visit-date")} className="form-error">{errors.date}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="visit-time">{t("scheduleVisit.time")}</label>
          <select id="visit-time" name="time" value={form.time} onChange={handleChange} {...fieldErrorProps("visit-time", errors.time)}>
            <option value="">{t("scheduleVisit.timePlaceholder")}</option>
            {REQUEST_TIME_OPTIONS.map((hour) => (
              <option key={hour} value={hour}>{hour}</option>
            ))}
          </select>
          {errors.time && <span id={errorId("visit-time")} className="form-error">{errors.time}</span>}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="visit-note">{t("scheduleVisit.note")}</label>
        <textarea id="visit-note" name="note" rows={2} value={form.note} onChange={handleChange} placeholder={t("scheduleVisit.notePlaceholder")} />
      </div>

      {formError && <p className="form-error" role="alert">{formError}</p>}
      {status === "error" && <p className="form-error">{t("contact.error")}</p>}
      {status === "rateLimited" && <p className="form-error">{t("contact.rateLimited")}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
        {status === "sending" ? <span className="spinner" /> : null}
        {status === "sending" ? t("contact.sending") : t("scheduleVisit.submit")}
      </button>
    </form>
  );
}

export default function ScheduleVisitCard({ property }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // null = todavía no se piden / cargando; [] = sin horarios (formulario de solicitud).
  const [slots, setSlots] = useState(null);
  const [requestMode, setRequestMode] = useState(false);

  // La barra fija de la ficha en móvil ("Agendar visita") abre el formulario.
  useEffect(() => {
    const openForm = () => setOpen(true);
    window.addEventListener(OPEN_SCHEDULE_EVENT, openForm);
    return () => window.removeEventListener(OPEN_SCHEDULE_EVENT, openForm);
  }, []);

  // Los horarios libres se piden al abrir la tarjeta (no en cada visita a la
  // ficha). Si falla, queda el formulario de solicitud: nunca se pierde el contacto.
  const loadSlots = useCallback(() => db.getVisitSlots(property.id).then(setSlots).catch(() => setSlots([])), [property.id]);

  useEffect(() => {
    if (open && slots === null) loadSlots();
  }, [open, slots, loadSlots]);

  return (
    <div className="card schedule-visit-card" id={SCHEDULE_TARGET_ID}>
      <h3 className="property-detail__sidebar-title">{t("scheduleVisit.title")}</h3>

      {!open ? (
        <>
          <p className="form-hint">{t("scheduleVisit.subtitle")}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setOpen(true)}>
            {t("scheduleVisit.cta")}
          </button>
        </>
      ) : slots === null ? (
        <p className="form-hint" role="status">
          {t("scheduleVisit.booking.loading")}
        </p>
      ) : slots.length > 0 && !requestMode ? (
        <VisitBooking property={property} slots={slots} onReload={loadSlots} onRequestInstead={() => setRequestMode(true)} />
      ) : (
        <VisitRequestForm property={property} noSlots={slots.length === 0} onBack={slots.length > 0 ? () => setRequestMode(false) : null} />
      )}
    </div>
  );
}
