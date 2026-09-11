import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";

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

export default function ContactForm() {
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.email.trim()) next.email = t("contact.required");
    else if (!EMAIL_RE.test(form.email)) next.email = t("contact.invalidEmail");
    if (!form.message.trim()) next.message = t("contact.required");
    setErrors(next);
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

    const lastSubmit = Number(window.localStorage.getItem(RATE_LIMIT_KEY) || 0);
    if (Date.now() - lastSubmit < RATE_LIMIT_MS) {
      setStatus("rateLimited");
      return;
    }

    setStatus("sending");
    try {
      const { empresa: _empresa, ...payload } = form;
      await db.submitContactMessage(payload);
      window.localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
      setStatus("success");
      setForm(initialForm);
    } catch {
      setStatus("error");
    }
  };

  return (
    <form className="card contact-form" onSubmit={handleSubmit} noValidate style={{ padding: "1.75rem" }}>
      {/* Campo trampa: invisible y fuera del tabulador para una persona,
          pero un bot que llena cualquier <input> del formulario sí lo ve. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
        <label htmlFor="contact-empresa">Empresa</label>
        <input id="contact-empresa" name="empresa" value={form.empresa} onChange={handleChange} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="form-field">
        <label htmlFor="contact-name">{t("contact.name")}</label>
        <input id="contact-name" name="name" value={form.name} onChange={handleChange} aria-invalid={Boolean(errors.name)} />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="contact-email">{t("contact.email")}</label>
          <input id="contact-email" name="email" type="email" value={form.email} onChange={handleChange} aria-invalid={Boolean(errors.email)} />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="contact-phone">{t("contact.phone")}</label>
          <input id="contact-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="contact-message">{t("contact.message")}</label>
        <textarea id="contact-message" name="message" rows={5} value={form.message} onChange={handleChange} aria-invalid={Boolean(errors.message)} />
        {errors.message && <span className="form-error">{errors.message}</span>}
      </div>

      {status === "success" && <p className="form-hint" style={{ color: "var(--color-success)" }}>{t("contact.success")}</p>}
      {status === "error" && <p className="form-error">{t("contact.error")}</p>}
      {status === "rateLimited" && <p className="form-error">{t("contact.rateLimited")}</p>}

      <p className="form-hint" style={{ marginBottom: "1rem" }}>
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
