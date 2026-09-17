import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import "./ScheduleVisitCard.css";

// Reemplaza a las tarjetas de asesor (nombre + teléfono + correo + botones
// de llamar/WhatsApp) que antes se mostraban en la ficha de cada
// propiedad: ahora el interesado deja su nombre y su teléfono y es el
// asesor quien le marca o le escribe. La solicitud llega como un
// contact_message más — mismo inbox en /admin/mensajes, mismo aviso
// automático por WhatsApp del trigger de Supabase — igual que la
// solicitud de visita, así que no hace falta tabla ni pantalla nuevas.
//
// contact_messages.email es NOT NULL y este formulario no pide correo, así
// que se manda cadena vacía; /admin/mensajes ya trata el correo vacío como
// "—" y no muestra el botón de correo en esos casos.
const RATE_LIMIT_KEY = "acl_callback_last_submit";
const RATE_LIMIT_MS = 60_000;

// Mínimo de dígitos de un teléfono en México (10 sin lada de país). Solo
// se cuentan dígitos: la gente escribe 871-123-4567, (871) 123 4567, etc.
const MIN_PHONE_DIGITS = 10;

function buildRequestMessage(property) {
  const label = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
  const link = typeof window !== "undefined" ? `\n${window.location.origin}/propiedades/${property.id}` : "";
  return `Solicitud de contacto — ${label}.\nPide que le llamen o le escriban por WhatsApp.${link}`;
}

export default function ContactRequestCard({ property }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", phone: "", empresa: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    const digits = form.phone.replace(/\D/g, "");
    if (!form.phone.trim()) next.phone = t("contact.required");
    else if (digits.length < MIN_PHONE_DIGITS) next.phone = t("contactRequest.invalidPhone");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Campo trampa lleno: casi seguro es un bot. Éxito falso, sin escribir nada.
    if (form.empresa.trim()) {
      setStatus("success");
      setForm({ name: "", phone: "", empresa: "" });
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
        name: form.name.trim(),
        email: "",
        phone: form.phone.trim(),
        message: buildRequestMessage(property),
      });
      window.localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
      setStatus("success");
      setForm({ name: "", phone: "", empresa: "" });
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="card schedule-visit-card">
        <h3 className="property-detail__sidebar-title">{t("contactRequest.title")}</h3>
        <p className="form-hint" style={{ color: "var(--color-success)" }}>{t("contactRequest.success")}</p>
      </div>
    );
  }

  return (
    <div className="card schedule-visit-card">
      <h3 className="property-detail__sidebar-title">{t("contactRequest.title")}</h3>
      <p className="form-hint">{t("contactRequest.subtitle")}</p>

      <form onSubmit={handleSubmit} noValidate>
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
          <label htmlFor="callback-empresa">Empresa</label>
          <input id="callback-empresa" name="empresa" value={form.empresa} onChange={handleChange} tabIndex={-1} autoComplete="off" />
        </div>

        <div className="form-field">
          <label htmlFor="callback-name">{t("contact.name")}</label>
          <input
            id="callback-name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="callback-phone">{t("contact.phone")}</label>
          <input
            id="callback-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("contactRequest.phonePlaceholder")}
            value={form.phone}
            onChange={handleChange}
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone && <span className="form-error">{errors.phone}</span>}
        </div>

        {status === "error" && <p className="form-error">{t("contact.error")}</p>}
        {status === "rateLimited" && <p className="form-error">{t("contact.rateLimited")}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
          {status === "sending" ? <span className="spinner" /> : null}
          {status === "sending" ? t("contact.sending") : t("contactRequest.submit")}
        </button>

        <p className="form-hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          {t("contact.privacyNotice")} <Link to="/aviso-de-privacidad">{t("contact.privacyLinkLabel")}</Link>.
        </p>
      </form>
    </div>
  );
}
