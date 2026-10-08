import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePendingToday } from "../lib/usePendingToday";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { isPushSupported, getExistingSubscription, subscribeToPush, unsubscribeFromPush, subscriptionToRow } from "../lib/pushNotifications";
import "./NotificationBell.css";

// Campana del topbar del admin: mismo cálculo de "pendientes de hoy" que ya
// se ve en el Panel principal (PendingToday), pero visible desde cualquier
// apartado — así no hace falta volver al Panel solo para saber si hay algo
// nuevo. El número es la suma de todos los pendientes, no la cantidad de
// categorías (un 1 debajo de "Mensajes sin contestar" con 5 mensajes
// nuevos se sentiría engañoso).
export default function NotificationBell() {
  const { t } = useTranslation();
  const { items } = usePendingToday();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const rootRef = useRef(null);
  const pushSupported = isPushSupported();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!pushSupported) return;
    getExistingSubscription().then((sub) => setPushEnabled(Boolean(sub)));
  }, [pushSupported]);

  const togglePush = async () => {
    if (!isSupabaseConfigured) {
      window.alert(t("admin.pushDemoUnavailable"));
      return;
    }
    setPushBusy(true);
    try {
      if (pushEnabled) {
        const subscription = await unsubscribeFromPush();
        if (subscription) await db.deletePushSubscription(subscription.endpoint).catch(() => {});
        setPushEnabled(false);
      } else {
        const subscription = await subscribeToPush();
        await db.savePushSubscription(subscriptionToRow(subscription, session?.user?.email));
        setPushEnabled(true);
      }
    } catch (err) {
      window.alert(err.message || t("admin.pushError"));
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  const list = items || [];
  const total = list.reduce((sum, item) => sum + item.count, 0);
  const hasWarn = list.some((item) => item.tone === "warn");

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="icon-toggle notification-bell__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("admin.notifications")}
        aria-expanded={open}
        title={t("admin.notifications")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && <span className={`notification-bell__badge${hasWarn ? " notification-bell__badge--warn" : ""}`}>{total > 99 ? "99+" : total}</span>}
      </button>

      {open && (
        <div className="notification-bell__menu">
          {list.length === 0 ? (
            <p className="form-hint notification-bell__empty">{t("pending.allClear")}</p>
          ) : (
            <ul className="notification-bell__list">
              {list.map((item) => (
                <li key={item.key}>
                  <Link to={item.to} className={`notification-bell__item${item.tone ? ` notification-bell__item--${item.tone}` : ""}`} onClick={() => setOpen(false)}>
                    <span className="notification-bell__item-count">{item.count}</span>
                    <span>
                      {t(`pending.items.${item.key}`)}
                      {item.note && <span className="notification-bell__item-note"> · {item.note}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="notification-bell__footer">
            {pushSupported && (
              <button type="button" className="notification-bell__push-toggle" onClick={togglePush} disabled={pushBusy}>
                {pushEnabled ? t("admin.pushDisable") : t("admin.pushEnable")}
              </button>
            )}
            <Link to="/admin" className="notification-bell__viewall" onClick={() => setOpen(false)}>
              {t("admin.dashboard")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
