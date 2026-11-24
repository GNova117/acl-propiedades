import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { analyticsAvailable } from "../lib/analytics";
import { getConsent, OPEN_CONSENT_EVENT, setConsent } from "../lib/consent";
import "./CookieBanner.css";

// Aviso para aceptar o rechazar Google Analytics. Solo sale si el sitio tiene analítica configurada y la
// persona aún no ha decidido (o si pulsa "Preferencias de cookies" en el pie). No tapa el contenido con un
// fondo ni bloquea la página: es una franja al pie con dos botones de igual jerarquía (aceptar y rechazar).
export default function CookieBanner() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => analyticsAvailable && getConsent() === null);

  useEffect(() => {
    if (!analyticsAvailable) return undefined;
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (value) => {
    setConsent(value);
    setOpen(false);
  };

  return (
    <section className="cookie-banner" role="region" aria-labelledby="cookie-banner-title">
      <div className="cookie-banner__text">
        <strong id="cookie-banner-title">{t("cookieBanner.title")}</strong>
        <p>
          {t("cookieBanner.text")} <Link to="/aviso-de-privacidad">{t("cookieBanner.privacy")}</Link>.
        </p>
      </div>
      <div className="cookie-banner__actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => choose("denied")}>
          {t("cookieBanner.reject")}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => choose("granted")}>
          {t("cookieBanner.accept")}
        </button>
      </div>
    </section>
  );
}
