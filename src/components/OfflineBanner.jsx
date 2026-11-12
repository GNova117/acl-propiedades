import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOfflineQueue } from "../lib/useOfflineQueue";
import "./OfflineBanner.css";

const formatWhen = (iso) => new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Aviso del panel para la captura sin señal (ver lib/offlineQueue.js): solo se ve cuando hace falta —sin
// conexión, con cambios por enviar, con alguno que falló o recién enviados— y deja ver qué hay en la cola,
// enviarlo ya, reintentar lo que falló o descartarlo. Es el ÚNICO lugar donde se monta useOfflineQueue
// (él envía la cola).
export default function OfflineBanner() {
  const { t } = useTranslation();
  const { online, ops, pending, failed, flushing, sent, flush, discard, retry } = useOfflineQueue();
  const [open, setOpen] = useState(false);

  if (online && ops.length === 0 && sent === 0) return null;

  const tone = failed.length > 0 ? "error" : !online ? "offline" : pending > 0 ? "pending" : "ok";
  let status;
  if (!online) status = pending > 0 ? t("offline.banner.offlinePending", { count: pending }) : t("offline.banner.offline");
  else if (pending > 0) status = flushing ? t("offline.banner.sending") : t("offline.banner.pending", { count: pending });
  else if (sent > 0) status = t("offline.banner.sent", { count: sent });

  return (
    <section className={`offline-banner offline-banner--${tone}`} aria-label={t("offline.banner.label")}>
      <div className="offline-banner__row">
        <p className="offline-banner__text" role="status">
          {status}
          {failed.length > 0 && ` ${t("offline.banner.failed", { count: failed.length })}`}
        </p>
        <div className="offline-banner__actions">
          {online && pending > 0 && !flushing && (
            <button type="button" className="btn btn-primary btn-sm" onClick={flush}>
              {t("offline.banner.sendNow")}
            </button>
          )}
          {ops.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? t("offline.banner.hide") : t("offline.banner.view")}
            </button>
          )}
        </div>
      </div>

      {open && ops.length > 0 && (
        <ul className="offline-banner__list">
          {ops.map((op) => (
            <li key={op.id} className={`offline-banner__item${op.failed ? " is-failed" : ""}`}>
              <div className="offline-banner__item-text">
                <strong>
                  {op.type === "prospect.add"
                    ? t("offline.op.prospect", { name: op.label })
                    : t("offline.op.contact", { name: op.label, channel: t(`prospects.contact.channels.${op.payload.channel}`, { defaultValue: op.payload.channel }) })}
                </strong>
                <span className="form-hint">
                  {t("offline.op.when", { when: formatWhen(op.createdAt) })}
                  {op.failed && ` · ${t("offline.op.failed", { error: op.lastError })}`}
                </span>
              </div>
              <div className="offline-banner__item-actions">
                {op.failed && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => retry(op.id)}>
                    {t("offline.op.retry")}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    if (window.confirm(t("offline.op.confirmDiscard"))) discard(op.id);
                  }}
                >
                  {t("offline.op.discard")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
