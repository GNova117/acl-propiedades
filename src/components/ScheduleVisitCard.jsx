import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import "./ScheduleVisitCard.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initialForm = { name: "", email: "", phone: "", date: "", time: "", note: "", empresa: "" };

// Reusa la infraestructura de Mensajes de contacto en vez de un módulo
// propio: la solicitud llega como un contact_message más (misma tabla,
// mismo inbox en /admin/mensajes, mismo aviso automático por WhatsApp una
// vez que la plantilla de Meta esté aprobada) — el usuario eligió
// explícitamente "que llegue como solicitud que alguien revise y agende"
// en vez de insertarse directo en la Agenda del asesor, así que no hace
// falta una tabla ni una pantalla de admin nuevas. Fecha/hora van dentro
// del texto del mensaje (contact_messages no tiene esas columnas), con
// formato legible para quien lo lee en el inbox.
const RATE_LIMIT_KEY = "acl_contact_last_submit";
const RATE_LIMIT_MS = 60_000;

function buildVisitMessage(property, { date, time, note }, t) {
  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const label = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
  let message = `Solicitud de visita — ${label}.\nFecha preferida: ${dateLabel}`;
  if (time) message += ` a las ${time}`;
  if (note.trim()) message += `\nNota: ${note.trim()}`;
  return message;
}

export default function ScheduleVisitCard({ property }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.email.trim()) next.email = t("contact.required");
    else if (!EMAIL_RE.test(form.email)) next.email = t("contact.invalidEmail");
    if (!form.phone.trim()) next.phone = t("contact.required");
    if (!form.date) next.date = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (form.empresa.trim()) {
      setStatus("success");
      setForm(initialForm);
      return;
    }

    const lastSubmit = Number(window.localStorage.getItem(RATE_LIMIT_KEY) || 0);
    if (Date.now() - lastSubmit < RATE_LIMIT_MS) {
      setStatus("rateLimited");
      return;
    }

    setStatus("sending");
    try {
      await db.submitContactMessage({
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: buildVisitMessage(property, form, t),
      });
      window.localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
      setStatus("success");
      setForm(initialForm);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="card schedule-visit-card">
      <h3 className="property-detail__sidebar-title">{t("scheduleVisit.title")}</h3>

      {!open ? (
        <>
          <p className="form-hint">{t("scheduleVisit.subtitle")}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setOpen(true)}>
            {t("scheduleVisit.cta")}
          </button>
        </>
      ) : status === "success" ? (
        <p className="form-hint" style={{ color: "var(--color-success)" }}>{t("scheduleVisit.success")}</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
            <label htmlFor="visit-empresa">Empresa</label>
            <input id="visit-empresa" name="empresa" value={form.empresa} onChange={handleChange} tabIndex={-1} autoComplete="off" />
          </div>

          <div className="form-field">
            <label htmlFor="visit-name">{t("contact.name")}</label>
            <input id="visit-name" name="name" value={form.name} onChange={handleChange} aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="visit-email">{t("contact.email")}</label>
              <input id="visit-email" name="email" type="email" value={form.email} onChange={handleChange} aria-invalid={Boolean(errors.email)} />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="visit-phone">{t("contact.phone")}</label>
              <input id="visit-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} aria-invalid={Boolean(errors.phone)} />
              {errors.phone && <span className="form-error">{errors.phone}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="visit-date">{t("scheduleVisit.date")}</label>
              <input
                id="visit-date"
                name="date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.date}
                onChange={handleChange}
                aria-invalid={Boolean(errors.date)}
              />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="visit-time">{t("scheduleVisit.time")}</label>
              <input id="visit-time" name="time" type="time" value={form.time} onChange={handleChange} />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="visit-note">{t("scheduleVisit.note")}</label>
            <textarea id="visit-note" name="note" rows={2} value={form.note} onChange={handleChange} placeholder={t("scheduleVisit.notePlaceholder")} />
          </div>

          {status === "error" && <p className="form-error">{t("contact.error")}</p>}
          {status === "rateLimited" && <p className="form-error">{t("contact.rateLimited")}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
            {status === "sending" ? <span className="spinner" /> : null}
            {status === "sending" ? t("contact.sending") : t("scheduleVisit.submit")}
          </button>
        </form>
      )}
    </div>
  );
}
