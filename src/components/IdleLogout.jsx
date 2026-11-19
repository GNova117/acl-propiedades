import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ACTIVITY_KEY, idleLimitMs, idleState, readLastActivity, writeLastActivity } from "../lib/idleSession";
import "./IdleLogout.css";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"];
const WRITE_EVERY_MS = 5_000;

// Cierra la sesión del panel tras un rato sin actividad (ver lib/idleSession.js). Avisa 60 s antes con un diálogo y deja
// seguir. Sin conexión no cierra (el asesor en campo sigue capturando; se revisa al volver la señal).
export default function IdleLogout({ onExpire, canExpire = () => true }) {
  const { t } = useTranslation();
  const [warning, setWarning] = useState(null); // segundos que faltan, o null
  const lastWrite = useRef(0);
  const expired = useRef(false);
  const limitMs = idleLimitMs(undefined, typeof window === "undefined" ? undefined : window.__ACL_IDLE_LIMIT_MS__);

  const touch = useCallback(() => {
    const now = Date.now();
    if (now - lastWrite.current < WRITE_EVERY_MS) return;
    lastWrite.current = now;
    writeLastActivity(now);
  }, []);

  const stayActive = useCallback(() => {
    lastWrite.current = 0;
    touch();
    setWarning(null);
  }, [touch]);

  useEffect(() => {
    if (!limitMs) return undefined;
    expired.current = false;
    lastWrite.current = 0;
    touch();
    const onActivity = () => {
      // Con el aviso abierto solo cuenta pulsar «Seguir aquí»: tocar la página de fondo no basta.
      if (!document.querySelector(".idle-logout")) touch();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    const onStorage = (event) => {
      if (event.key === ACTIVITY_KEY) setWarning(null);
    };
    window.addEventListener("storage", onStorage);

    const check = () => {
      if (expired.current || navigator.onLine === false || !canExpire()) return;
      const { state, remainingMs } = idleState(readLastActivity(), Date.now(), limitMs);
      if (state === "expired") {
        expired.current = true;
        setWarning(null);
        onExpire();
      } else {
        setWarning(state === "warning" ? Math.max(1, Math.ceil(remainingMs / 1000)) : null);
      }
    };
    const timer = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      window.removeEventListener("storage", onStorage);
    };
  }, [limitMs, onExpire, canExpire, touch]);

  if (warning === null) return null;
  return (
    <div className="idle-logout" role="alertdialog" aria-modal="true" aria-labelledby="idle-logout-title" aria-describedby="idle-logout-text">
      <div className="idle-logout__card card">
        <h2 id="idle-logout-title">{t("idle.title")}</h2>
        <p id="idle-logout-text">{t("idle.text", { count: warning })}</p>
        <div className="idle-logout__actions">
          <button type="button" className="btn btn-primary" onClick={stayActive} autoFocus>
            {t("idle.stay")}
          </button>
          <button type="button" className="btn btn-outline" onClick={onExpire}>
            {t("idle.logoutNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
