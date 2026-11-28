import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/useAuth.js";
import { db } from "../lib/dataStore";
import "./MfaNudge.css";

const DISMISS_KEY = "acl_mfa_nudge_until";
const DISMISS_DAYS = 7;

// Aviso en el panel a quien aún no activó la verificación en dos pasos (en modo demo no se muestra). Se puede posponer 7 días.
export default function MfaNudge() {
  const { t } = useTranslation();
  const { isDemoMode, session } = useAuth();
  const [show, setShow] = useState(false);
  const email = session?.user?.email;

  useEffect(() => {
    if (isDemoMode || !email) return undefined;
    try {
      if (Date.now() < Number(localStorage.getItem(DISMISS_KEY) || 0)) return undefined;
    } catch {
      /* sin almacenamiento: se muestra */
    }
    let active = true;
    db.getMfaStatus()
      .then((status) => active && setShow(!status.enrolled))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isDemoMode, email]);

  if (!show) return null;
  const later = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400_000));
    } catch {
      /* se vuelve a mostrar la próxima vez */
    }
    setShow(false);
  };
  return (
    <div className="mfa-nudge card" role="status">
      <span>{t("mfa.nudge")}</span>
      <span className="mfa-nudge__actions">
        <Link to="/admin/seguridad" className="btn btn-primary btn-sm">{t("mfa.nudgeAction")}</Link>
        <button type="button" className="btn btn-outline btn-sm" onClick={later}>{t("mfa.nudgeLater")}</button>
      </span>
    </div>
  );
}
