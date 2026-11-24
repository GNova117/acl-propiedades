import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DISMISS_KEY, VIEWS_KEY, dismissUntil, shouldShowInstallBanner } from "../lib/installBanner";
import "./PublicInstallBanner.css";

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const readNumber = (storage, key) => {
  try {
    return Number(storage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

// Invitación discreta a instalar la app pública («ACL Propiedades») en el teléfono: favoritos y búsqueda a un toque. Ver
// lib/installBanner.js para cuándo se muestra. No es fija: va en la página, arriba del pie, para no tapar nada.
export default function PublicInstallBanner() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [prompt, setPrompt] = useState(null);
  const [views, setViews] = useState(() => readNumber(window.sessionStorage, VIEWS_KEY));
  const [dismissedUntil, setDismissedUntil] = useState(() => readNumber(window.localStorage, DISMISS_KEY));
  const [hint, setHint] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());

  // Cuenta las páginas vistas en esta visita.
  useEffect(() => {
    setViews((previous) => {
      const next = previous + 1;
      try {
        window.sessionStorage.setItem(VIEWS_KEY, String(next));
      } catch {
        /* sin almacenamiento: solo cuenta en memoria */
      }
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const show = shouldShowInstallBanner({ views, dismissedUntil, now: Date.now(), standalone: installed, canPrompt: Boolean(prompt), ios: isIos() });
  if (!show) return null;

  const later = () => {
    const until = dismissUntil();
    try {
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      /* se volverá a ofrecer */
    }
    setDismissedUntil(until);
  };

  const install = async () => {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice.catch(() => {});
      setPrompt(null);
    } else {
      setHint((value) => !value);
    }
  };

  return (
    <section className="install-banner" aria-label={t("installApp.title")}>
      <div className="container install-banner__inner">
        <div>
          <strong>{t("installApp.title")}</strong>
          <p>{hint ? t("installApp.iosHint") : t("installApp.text")}</p>
        </div>
        <div className="install-banner__actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={install}>
            {t("installApp.install")}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={later}>
            {t("installApp.later")}
          </button>
        </div>
      </div>
    </section>
  );
}
