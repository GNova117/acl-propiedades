import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../lib/format";
import { describeCriteria } from "../lib/alertMatch";
import { isValidPhone } from "../lib/lead";
import "./AlertSignupCard.css";

const ERRORS = {
  bad_phone: "alerts.errors.badPhone",
  name_required: "alerts.errors.name",
  limit: "alerts.errors.limit",
  property_unavailable: "alerts.errors.unavailable",
  bad_criteria: "alerts.errors.generic",
};

// Tarjeta para pedir avisos por WhatsApp: en el listado, "avísame cuando haya una
// propiedad como estas" (mode "search", con los filtros actuales) y en la ficha,
// "avísame si baja de precio" (mode "price"). Pide nombre y WhatsApp, con el
// consentimiento a la vista; cada aviso lleva su enlace para darse de baja.
export default function AlertSignupCard({ mode, criteria, property, matchCount }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", phone: "", empresa: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | success | duplicate | error
  const [errorKey, setErrorKey] = useState("");
  const rateKey = `acl_alert_${mode}_last_submit`;

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const chips = mode === "search" ? describeCriteria(criteria, { money: formatMXN }) : [];

  const summary = () => {
    if (mode === "price") return `${property.title} (${formatMXN(property.price)})`;
    return chips
      .map(({ key, value }) => `${t(`alerts.criteria.${key}`)}: ${key === "type" ? propertyTypeLabel(t, value) : value}`)
      .join(" · ") || t("alerts.anyProperty");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.phone.trim()) next.phone = t("contact.required");
    else if (!isValidPhone(form.phone)) next.phone = t("contactRequest.invalidPhone");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Campo trampa lleno: éxito falso, sin escribir nada.
    if (form.empresa.trim()) {
      setStatus("success");
      return;
    }
    try {
      const last = Number(window.localStorage.getItem(rateKey) || 0);
      if (Date.now() - last < 30_000) {
        setErrorKey("alerts.errors.wait");
        setStatus("error");
        return;
      }
    } catch {
      /* sin almacenamiento */
    }

    setStatus("sending");
    try {
      const result = await db.subscribeAlert({
        kind: mode,
        name: form.name.trim(),
        phone: form.phone.trim(),
        criteria: mode === "search" ? criteria : {},
        propertyId: mode === "price" ? property.id : null,
      });
      if (result?.error) {
        setErrorKey(ERRORS[result.error] || "alerts.errors.generic");
        setStatus("error");
        return;
      }
      try {
        window.localStorage.setItem(rateKey, String(Date.now()));
      } catch {
        /* sin almacenamiento */
      }
      setStatus(result?.duplicate ? "duplicate" : "success");
      // Aviso interno: llega a Mensajes (y de ahí a Prospectos) para que el equipo sepa que hay un interesado.
      db.submitContactMessage({
        name: form.name.trim(),
        email: "",
        phone: form.phone.trim(),
        message: `${mode === "price" ? "Pidió aviso de baja de precio" : "Pidió avisos de propiedades nuevas"} — ${summary()}`,
        property_id: mode === "price" ? property.id : null,
        channel: "alerta",
      }).catch(() => {});
    } catch {
      setErrorKey("alerts.errors.generic");
      setStatus("error");
    }
  };

  if (status === "success" || status === "duplicate") {
    return (
      <div className="card alert-signup">
        <h2 className="alert-signup__title">{t(`alerts.${mode}.title`)}</h2>
        <p className="form-hint" style={{ color: "var(--color-success)", marginBottom: 0 }}>
          {t(status === "duplicate" ? "alerts.duplicate" : `alerts.${mode}.success`)}
        </p>
      </div>
    );
  }

  return (
    <div className="card alert-signup">
      <h2 className="alert-signup__title">{t(`alerts.${mode}.title`)}</h2>
      <p className="form-hint">{t(`alerts.${mode}.subtitle`)}</p>

      {mode === "search" && (
        <p className="alert-signup__criteria">
          {chips.length === 0 ? (
            <span className="alert-signup__chip">{t("alerts.anyProperty")}</span>
          ) : (
            chips.map(({ key, value }) => (
              <span className="alert-signup__chip" key={key}>
                {t(`alerts.criteria.${key}`)}: {key === "type" ? propertyTypeLabel(t, value) : value}
              </span>
            ))
          )}
          {typeof matchCount === "number" && <span className="form-hint">{t("alerts.todayMatches", { count: matchCount })}</span>}
        </p>
      )}
      {mode === "price" && (
        <p className="alert-signup__criteria">
          <span className="alert-signup__chip">
            {t("alerts.currentPrice")}: {formatMXN(property.price)}
          </span>
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
          <label htmlFor={`alert-${mode}-empresa`}>Empresa</label>
          <input id={`alert-${mode}-empresa`} name="empresa" value={form.empresa} onChange={change} tabIndex={-1} autoComplete="off" />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor={`alert-${mode}-name`}>{t("contact.name")}</label>
            <input id={`alert-${mode}-name`} name="name" autoComplete="name" value={form.name} onChange={change} aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-field">
            <label htmlFor={`alert-${mode}-phone`}>{t("alerts.whatsapp")}</label>
            <input
              id={`alert-${mode}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("contactRequest.phonePlaceholder")}
              value={form.phone}
              onChange={change}
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>
        </div>
        {status === "error" && <p className="form-error">{t(errorKey || "alerts.errors.generic")}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
          {status === "sending" ? <span className="spinner" /> : null}
          {t(`alerts.${mode}.submit`)}
        </button>
        <p className="form-hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          {t("alerts.consent")} <Link to="/aviso-de-privacidad">{t("contact.privacyLinkLabel")}</Link>.
        </p>
      </form>
    </div>
  );
}
