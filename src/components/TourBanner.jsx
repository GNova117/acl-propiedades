import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/useAuth.js";
import { isTourSeen, markTourSeen } from "../lib/helpTopics";
import AdminTour from "./AdminTour";
import "./AdminTour.css";

// La primera vez que alguien entra al panel (por persona y dispositivo) se le ofrece el recorrido guiado en un aviso
// que NO bloquea nada. En modo demo no se ofrece (se entra con la misma cuenta siempre, cada prueba, y sería ruido).
export default function TourBanner() {
  const { t } = useTranslation();
  const { session, isDemoMode } = useAuth();
  const email = session?.user?.email;
  const [dismissed, setDismissed] = useState(() => isTourSeen(email));
  const [open, setOpen] = useState(false);

  const finish = () => {
    markTourSeen(email);
    setOpen(false);
    setDismissed(true);
  };

  if (isDemoMode || !email) return null;
  return (
    <>
      {!dismissed && !open && (
        <div className="card tour-banner" role="region" aria-label={t("help.banner.label")}>
          <p>{t("help.banner.text")}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            {t("help.banner.start")}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={finish}>
            {t("help.banner.later")}
          </button>
        </div>
      )}
      {open && <AdminTour onClose={finish} />}
    </>
  );
}
