import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { PROBLEM_MAX_LENGTH, buildProblemPayload, validateProblem } from "../lib/problemReport";
import "./PropertyProspectsModal.css";
import "./PropertyOffersModal.css";

// Botón «Reportar un problema» del panel: cualquiera del equipo con sesión cuenta qué notó. Queda en «Errores del sitio»
// (junto a los errores automáticos) con su correo como etiqueta. No se manda por correo: se consulta en esa pantalla. Ver lib/problemReport.js.
export default function ReportProblem({ compact = false }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    setOpen(false);
    setSent(false);
    setError("");
    setText("");
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    const invalid = validateProblem(text);
    if (invalid) {
      setError(t(`reportProblem.errors.${invalid}`));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await db.reportUserProblem(
        buildProblemPayload({ message: text, pathname, userAgent: navigator.userAgent, release: typeof __RELEASE__ === "undefined" ? "" : __RELEASE__ }),
      );
      setSent(true);
    } catch (err) {
      setError(t(err?.code === "rate_limited" ? "reportProblem.errors.rateLimited" : err?.code === "too_short" ? "reportProblem.errors.short" : "reportProblem.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="admin-layout__report" onClick={() => setOpen(true)} title={compact ? t("reportProblem.button") : undefined}>
        <span aria-hidden="true">⚑</span>
        <span className="admin-layout__nav-label">{t("reportProblem.button")}</span>
      </button>

      {open &&
        createPortal(
        <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("reportProblem.title")}>
          <div className="match-modal__backdrop" onClick={close} aria-hidden="true" />
          <div className="match-modal__box card offers-modal">
            <div className="match-modal__head">
              <h2>{t("reportProblem.title")}</h2>
              <button type="button" className="btn btn-outline btn-sm" onClick={close}>
                {t("common.close")}
              </button>
            </div>
            {sent ? (
              <>
                <p role="status">{t("reportProblem.thanks")}</p>
                <div className="offers-modal__actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={close}>
                    {t("common.close")}
                  </button>
                </div>
              </>
            ) : (
              <form className="offers-modal__form" onSubmit={submit} noValidate>
                <p className="form-hint">{t("reportProblem.hint")}</p>
                <div className="form-field">
                  <label htmlFor="problem-text">{t("reportProblem.label")}</label>
                  <textarea id="problem-text" rows={5} maxLength={PROBLEM_MAX_LENGTH} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("reportProblem.placeholder")} />
                  <span className="form-hint">{t("reportProblem.counter", { count: text.length, max: PROBLEM_MAX_LENGTH })}</span>
                </div>
                <p className="form-hint">{t("reportProblem.attached", { email: session?.user?.email || "", screen: pathname })}</p>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="offers-modal__actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                    {t("reportProblem.send")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
