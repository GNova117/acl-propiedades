import { useState } from "react";
import { saveContact, withRemembered } from "../lib/rememberedContact";
import { Link, useLocation } from "react-router-dom";
import { errorId, fieldErrorProps, focusFirstError } from "../lib/formErrors";
import { CONTACT_TOPICS, composeMessage, prefillMessage, topicFromSearch } from "../lib/contactPrefill";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { trackConversion } from "../lib/conversions";
import { lastSubmitAt, markSubmitted } from "../lib/rateLimitStore";
import { isValidPhone } from "../lib/lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialForm = { name: "", email: "", phone: "", message: "", empresa: "" };

// Freno anti-spam simple, sin backend ni servicio externo (no hay
// reCAPTCHA/hCaptcha aquí — eso implicaría pedirle al negocio crear otra
// cuenta externa, fuera de alcance por ahora): un campo trampa que un
// humano nunca ve ni llena, y un límite de un envío por minuto por
// navegador. No detiene a un atacante dedicado, pero sí a los bots
// genéricos que llenan cualquier <input> que encuentran.
const RATE_LIMIT_KEY = "acl_contact_last_submit";
const RATE_LIMIT_MS = 60_000;

export default function ContactForm({ initialMessage = "", showTopic = true }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [form, setForm] = useState(() => ({ ...withRemembered(initialForm), message: initialMessage || prefillMessage(location.search) }));
  const [topic, setTopic] = useState(() => (showTopic ? topicFromSearch(location.search) : ""));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.email.trim()) next.email = t("contact.required");
    else if (!EMAIL_RE.test(form.email)) next.email = t("contact.invalidEmail");
    // El teléfono es opcional, pero si se escribe debe ser un teléfono (antes aceptaba «abc» o 3 dígitos).
    if (form.phone.trim() && !isValidPhone(form.phone)) next.phone = t("contactRequest.invalidPhone");
    if (!form.message.trim()) next.message = t("contact.required");
    setErrors(next);
    // 261: con errores el foco va al primer campo que lo tiene.
    focusFirstError(next, ["name", "email", "phone", "message"], { name: "contact-name", email: "contact-email", phone: "contact-phone", message: "contact-message" });
    return Object.keys(next).length === 0;
  };

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Campo trampa lleno: casi seguro es un bot. Se le muestra éxito falso
    // (para no revelarle que fue detectado) sin escribir nada en la base.
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
      const { empresa: _empresa, ...payload } = form;
      payload.message = composeMessage(topic ? t(`contact.topics.${topic}`) : "", form.message);
      await db.submitContactMessage(payload);
      trackConversion("lead_form", { form: "contacto" });
      markSubmitted(RATE_LIMIT_KEY);
      saveContact(form);
      setStatus("success");
      setForm(initialForm);
    } catch (err) {
      setStatus(err?.code === "rate_limited" ? "serverLimited" : "error");
    }
  };

  return (
    <form className="card contact-form" onSubmit={handleSubmit} noValidate style={{ padding: "1.75rem" }}>
      {/* Campo trampa: invisible y fuera del tabulador para una persona,
          pero un bot que llena cualquier <input> del formulario sí lo ve. */}
      <div aria-hidden="true" className="hp-field">
        <label htmlFor="contact-empresa">Empresa</label>
        <input id="contact-empresa" name="empresa" value={form.empresa} onChange={handleChange} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="form-field">
        <label htmlFor="contact-name">{t("contact.name")}</label>
        <input id="contact-name" name="name" autoComplete="name" value={form.name} onChange={handleChange} {...fieldErrorProps("contact-name", errors.name)} />
        {errors.name && <span id={errorId("contact-name")} className="form-error">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="contact-email">{t("contact.email")}</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} {...fieldErrorProps("contact-email", errors.email)} />
          {errors.email && <span id={errorId("contact-email")} className="form-error">{errors.email}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="contact-phone">{t("contact.phone")}</label>
          <input id="contact-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={handleChange} {...fieldErrorProps("contact-phone", errors.phone)} />
          {errors.phone && <span id={errorId("contact-phone")} className="form-error">{errors.phone}</span>}
        </div>
      </div>

      {showTopic && (
        <div className="form-field">
          <label htmlFor="contact-topic">{t("contact.topicLabel")}</label>
          <select id="contact-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">{t("contact.topicNone")}</option>
            {CONTACT_TOPICS.map((key) => (
              <option key={key} value={key}>{t(`contact.topics.${key}`)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="contact-message">{t("contact.message")}</label>
        <textarea id="contact-message" name="message" rows={5} value={form.message} onChange={handleChange} {...fieldErrorProps("contact-message", errors.message)} />
        {errors.message && <span id={errorId("contact-message")} className="form-error">{errors.message}</span>}
      </div>

      {status === "success" && (
        <div className="contact-success" role="status">
          <p className="form-hint text-success">{t("contact.success")}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setStatus("idle")}>
            {t("contact.sendAnother")}
          </button>
        </div>
      )}
      {status === "error" && <p className="form-error" role="alert">{t("contact.error")}</p>}
      {status === "rateLimited" && <p className="form-error" role="alert">{t("contact.rateLimited")}</p>}
      {status === "serverLimited" && <p className="form-error" role="alert">{t("contact.serverLimited")}</p>}

      <p className="form-hint mb-4">
        {t("contact.privacyNotice")}{" "}
        <Link to="/aviso-de-privacidad">{t("contact.privacyLinkLabel")}</Link>.
      </p>

      <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
        {status === "sending" ? <span className="spinner" /> : null}
        {status === "sending" ? t("contact.sending") : t("contact.send")}
      </button>
    </form>
  );
}
