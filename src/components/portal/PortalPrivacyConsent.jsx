import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function PortalPrivacyConsent({ onAccept }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setError("");
    setBusy(true);
    try {
      await onAccept();
    } catch {
      setError(t("portal.consent.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card portal-consent">
      <h2>{t("portal.consent.title")}</h2>
      <p className="form-hint">{t("portal.consent.summary")}</p>
      <p className="form-hint">
        <Link to="/aviso-de-privacidad" target="_blank" rel="noopener noreferrer">
          {t("portal.consent.linkText")}
        </Link>
      </p>
      <label className="portal-consent__checkbox">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        {t("portal.consent.checkbox")}
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={!checked || busy} onClick={handleContinue}>
        {busy ? <span className="spinner" /> : null}
        {t("portal.consent.continue")}
      </button>
    </div>
  );
}
