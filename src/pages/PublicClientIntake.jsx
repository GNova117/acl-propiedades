import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageToggle from "../components/LanguageToggle";
import LoadingState from "../components/LoadingState";
import { db } from "../lib/dataStore";
import { emptyIntakeForm, INTAKE_CONSENT_VERSION, INTAKE_ERROR_FIELDS, intakeGroups, intakePayload, validateIntake } from "../lib/clientIntake";
import "./PublicVisitReport.css";
import "./PublicClientIntake.css";

// Un campo del expediente: mismos tipos que ExpedienteFieldInput del panel (texto, teléfono, correo, fecha, lista, área de texto).
function IntakeField({ field, value, onChange, error }) {
  const id = `intake-${field.key}`;
  const common = { id, value, onChange, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined };
  let control;
  if (field.type === "textarea") control = <textarea {...common} rows={3} />;
  else if (field.type === "select") {
    control = (
      <select {...common}>
        <option value="">—</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else control = <input {...common} type={field.type === "date" ? "date" : field.type || "text"} autoComplete="off" />;
  return (
    <div className={`form-field${field.full ? " public-intake__full" : ""}`}>
      <label htmlFor={id}>{field.label}</label>
      {control}
      {error && (
        <span className="form-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// Página pública /registro/<token>: el cliente captura sus propios datos (nombre, teléfono, correo y su expediente) y al enviar
// se crea en el panel. El asesor ya eligió si es comprador, vendedor o ambos: aquí no se pregunta. Sin iniciar sesión; el enlace
// sirve una sola vez y vence a los 7 días. Vive FUERA de PublicLayout (igual que /seleccion/ y /visita/): ese layout manda cada
// ruta a Google Analytics y el token, que es lo que da acceso, no debe llegar ahí.
export default function PublicClientIntake() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [state, setState] = useState({ token: null, status: "loading", type: null });
  const current = state.token === token ? state : { status: "loading", type: null };
  const [form, setForm] = useState(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null); // { field, code }
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    const previousTitle = document.title;
    document.title = `${t("intake.pageTitle")} | ACL Propiedades`;
    return () => {
      robots.remove();
      referrer.remove();
      document.title = previousTitle;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    db.getClientIntakeStatus(token)
      .then((data) => {
        if (cancelled) return;
        setState({ token, status: data?.status || "invalido", type: data?.type || null });
        if (data?.status === "activo") setForm(emptyIntakeForm(data.type));
      })
      .catch(() => !cancelled && setState({ token, status: "error", type: null }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const change = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: key === "rfc" || key === "curp" ? e.target.value.toUpperCase() : e.target.value }));
    if (error?.field === key) setError(null);
  };

  const errorText = (code) => t(`intake.errors.${code}`, { defaultValue: t("intake.errors.generic") });

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateIntake(form, { consent });
    if (problem) {
      setError(problem);
      document.getElementById(problem.field === "consent" ? "intake-consent" : `intake-${problem.field}`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await db.submitClientIntake(token, intakePayload(form, current.type), INTAKE_CONSENT_VERSION);
      if (result?.ok) setSent(true);
      else if (["invalido", "revocado", "usado", "expirado"].includes(result?.error)) setState({ token, status: result.error, type: null });
      else setError({ field: INTAKE_ERROR_FIELDS[result?.error] || null, code: result?.error || "generic" });
    } catch {
      setError({ field: null, code: "generic" });
    } finally {
      setBusy(false);
    }
  };

  const groups = current.status === "activo" && form ? intakeGroups(current.type) : [];
  const fieldError = (key) => (error?.field === key ? errorText(error.code) : null);

  return (
    <div className="public-report public-intake">
      <header className="public-report__bar">
        <Link to="/" className="public-report__logo" aria-label="ACL Propiedades">
          <Logo size="sm" />
        </Link>
        <div className="public-report__tools">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="public-intake__main">
        {current.status === "loading" && <LoadingState variant="lines" />}

        {["invalido", "revocado", "usado", "expirado", "error"].includes(current.status) && !sent && (
          <div className="card public-report__notice">
            <h1>{t(`intake.notice.${current.status}.title`)}</h1>
            <p>{t(`intake.notice.${current.status}.body`)}</p>
          </div>
        )}

        {sent && (
          <div className="card public-intake__card" role="status">
            <h1>{t("intake.thanksTitle")}</h1>
            <p>{t("intake.thanksBody")}</p>
            <Link to="/" className="btn btn-outline">
              {t("intake.backHome")}
            </Link>
          </div>
        )}

        {current.status === "activo" && form && !sent && (
          <form className="card public-intake__card" onSubmit={submit} noValidate>
            <h1>{t("intake.title")}</h1>
            <p>{t("intake.intro")}</p>

            <section className="public-intake__section" aria-labelledby="intake-contact">
              <h2 id="intake-contact">{t("intake.contactTitle")}</h2>
              <div className="public-intake__grid">
                <div className="form-field public-intake__full">
                  <label htmlFor="intake-name">{t("intake.name")}</label>
                  <input id="intake-name" value={form.name} onChange={change("name")} autoComplete="name" maxLength={120} aria-invalid={fieldError("name") ? true : undefined} />
                  {fieldError("name") && (
                    <span className="form-error" role="alert">
                      {fieldError("name")}
                    </span>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="intake-phone">{t("intake.phone")}</label>
                  <input id="intake-phone" type="tel" inputMode="tel" value={form.phone} onChange={change("phone")} autoComplete="tel" maxLength={30} aria-invalid={fieldError("phone") ? true : undefined} />
                  {fieldError("phone") && (
                    <span className="form-error" role="alert">
                      {fieldError("phone")}
                    </span>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="intake-email">{t("intake.email")}</label>
                  <input id="intake-email" type="email" value={form.email} onChange={change("email")} autoComplete="email" maxLength={160} aria-invalid={fieldError("email") ? true : undefined} />
                  {fieldError("email") && (
                    <span className="form-error" role="alert">
                      {fieldError("email")}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {groups.map((group) => (
              <section className="public-intake__section" key={group.key} aria-labelledby={`intake-g-${group.key}`}>
                <h2 id={`intake-g-${group.key}`}>{group.title}</h2>
                {group.key === "personal" && <p className="form-hint">{t("intake.optionalHint")}</p>}
                <div className="public-intake__grid">
                  {group.fields.map((field) => (
                    <IntakeField key={field.key} field={field} value={form[field.key]} onChange={change(field.key)} error={fieldError(field.key)} />
                  ))}
                </div>
              </section>
            ))}

            <div className="form-field public-intake__consent">
              <label>
                <input id="intake-consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (error?.field === "consent") setError(null); }} />
                <span>
                  {t("intake.consentBefore")}{" "}
                  <Link to="/aviso-de-privacidad" target="_blank" rel="noopener noreferrer">
                    {t("intake.consentLink")}
                  </Link>
                  .
                </span>
              </label>
              {fieldError("consent") && (
                <span className="form-error" role="alert">
                  {fieldError("consent")}
                </span>
              )}
            </div>

            {error && !error.field && (
              <p className="form-error" role="alert">
                {errorText(error.code)}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {t("intake.submit")}
            </button>
            <p className="form-hint">{t("intake.privacyNote")}</p>
          </form>
        )}
      </main>
    </div>
  );
}
