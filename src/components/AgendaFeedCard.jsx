import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import "./AgendaFeedCard.css";
import { confirmDialog } from "../lib/toast";

const feedUrl = (token) => `${window.location.origin}/api/agenda-ics?t=${token}`;

// «Ver mi Agenda en Google/Apple Calendar»: una URL secreta de SOLO lectura que el calendario externo vuelve a leer
// solo (se suscribe a ella). NO es una sincronización de dos vías: lo que se cambie en el calendario externo no llega
// al sitio. Quien tenga la URL ve las citas (título, hora, lugar, actividades; sin teléfonos de clientes), por eso
// se puede regenerar para invalidar la anterior. En modo demo no existe (necesita el servidor).
export default function AgendaFeedCard() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    db.getAgendaFeedToken()
      .then((value) => !cancelled && setToken(value))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const generate = async () => {
    if (token && !await confirmDialog(t("agendaFeed.confirmRegenerate"))) return;
    setBusy(true);
    setMessage("");
    try {
      setToken(await db.createAgendaFeedToken());
      setCopied(false);
    } catch (err) {
      setMessage(err?.message === "agendaFeed:demo" ? t("agendaFeed.demo") : t("agendaFeed.error"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl(token));
      setCopied(true);
    } catch {
      setMessage(t("agendaFeed.copyError"));
    }
  };

  return (
    <section className="card agenda-feed">
      <button type="button" className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t("agendaFeed.open")}
      </button>
      {open && (
        <div className="agenda-feed__body">
          <p className="form-hint">{t("agendaFeed.hint")}</p>
          <p className="form-hint">{t("agendaFeed.privacy")}</p>
          {token ? (
            <>
              <input className="agenda-feed__url" readOnly value={feedUrl(token)} aria-label={t("agendaFeed.urlLabel")} onFocus={(e) => e.target.select()} />
              <div className="agenda-feed__actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
                  {copied ? t("agendaFeed.copied") : t("agendaFeed.copy")}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={generate} disabled={busy}>
                  {t("agendaFeed.regenerate")}
                </button>
              </div>
              <p className="form-hint">{t("agendaFeed.howTo")}</p>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={generate} disabled={busy}>
              {t("agendaFeed.create")}
            </button>
          )}
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
