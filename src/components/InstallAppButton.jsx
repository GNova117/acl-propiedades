import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

// Botón "Instalar app" del panel. En Chrome/Edge/Android usa el aviso de
// instalación del navegador (beforeinstallprompt); en iPhone/iPad, donde el
// navegador no tiene ese aviso, explica cómo hacerlo desde "Compartir". No se
// muestra si la app ya está instalada.
export default function InstallAppButton() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
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

  if (installed) return null;
  const ios = isIos();
  if (!prompt && !ios) return null;

  const install = async () => {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice.catch(() => {});
      setPrompt(null);
    } else {
      setShowHint((v) => !v);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="btn btn-outline btn-sm" onClick={install}>
        {t("installApp.button")}
      </button>
      {showHint && (
        <div role="status" className="card" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 260, padding: "0.9rem", zIndex: 960, fontSize: "0.88rem" }}>
          {t("installApp.iosHint")}
        </div>
      )}
    </div>
  );
}
