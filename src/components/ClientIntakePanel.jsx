import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { useAuth } from "../context/useAuth.js";
import { INTAKE_LABEL_MAX, INTAKE_TYPES, INTAKE_VALID_DAYS, intakeMessage, intakeState, intakeUrl } from "../lib/clientIntake";
import { useLiveRefresh } from "../lib/liveUpdates";
import { confirmDialog, notify, copyFallback } from "../lib/toast";
import "./ClientIntakePanel.css";
import { siteOrigin } from "../lib/site";

const TYPE_KEY = { comprador: "buyer", vendedor: "seller", ambos: "both" };
const fmtDate = (value) => (value ? new Date(value).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "");

// Botones para mandar un enlace ya creado: WhatsApp (con el mensaje escrito; el asesor elige el chat) y copiar.
function LinkActions({ link }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  const url = intakeUrl(siteOrigin(), link.token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      copyFallback(t("clientIntake.copyFallback"), url);
    }
  };
  return (
    <div className="client-intake__actions">
      <a className="btn btn-primary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(intakeMessage(url, { name: link.label || "" }))}`} target="_blank" rel="noopener noreferrer">
        {t("clientIntake.sendWhatsapp")}
      </a>
      <button type="button" className="btn btn-outline btn-sm" onClick={copy}>
        {copied ? t("clientIntake.copied") : t("clientIntake.copy")}
      </button>
    </div>
  );
}

// «Enlace de registro»: el asesor elige si el cliente es comprador, vendedor o ambos, genera un enlace y se lo manda. El cliente
// lo abre sin iniciar sesión, llena sus datos y al enviar aparece en esta lista de Clientes. Cada enlace sirve una vez y vence a
// los INTAKE_VALID_DAYS días. Ver lib/clientIntake.js y la migración 0116.
export default function ClientIntakePanel({ onClose, onClientCreated }) {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const [type, setType] = useState("comprador");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState(null); // null = cargando
  const [created, setCreated] = useState(null); // el enlace recién creado
  const [freshIds, setFreshIds] = useState(() => new Set()); // registros que llegaron sin que nadie los hubiera visto: llevan la etiqueta «Nuevo»
  const seenRef = useRef(new Set());
  // Se guarda en una referencia: quien usa el panel pasa una función nueva en cada render y no debe volver a pedir la lista por eso.
  const onCreatedRef = useRef(onClientCreated);
  useEffect(() => {
    onCreatedRef.current = onClientCreated;
  });

  const load = useCallback(async () => {
    try {
      const data = await db.getClientIntakeLinks();
      setLinks(data);
      // Abrir el panel es «verlos»: dejan de contar en la campana, pero aquí siguen marcados como nuevos mientras el panel esté abierto.
      const unseen = data.filter((l) => l.submitted_at && !l.seen_at && !seenRef.current.has(l.id));
      if (unseen.length) {
        unseen.forEach((l) => seenRef.current.add(l.id));
        setFreshIds((prev) => new Set([...prev, ...unseen.map((l) => l.id)]));
        db.markClientIntakesSeen(unseen.map((l) => l.id)).catch(() => {});
        onCreatedRef.current?.();
      }
      return data;
    } catch {
      setLinks([]);
      notify(t("clientIntake.loadError"));
      return [];
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Si un cliente envía sus datos con el panel abierto, aparece solo (con su etiqueta «Nuevo»).
  const liveTick = useLiveRefresh(["client_intake_links"], { delayMs: 800 });
  useEffect(() => {
    if (liveTick) load();
  }, [liveTick, load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const link = await db.createClientIntakeLink({ type, label, advisorId });
      setCreated(link);
      setLabel("");
      load();
    } catch (err) {
      notify(err.message || t("clientIntake.createError"));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (link) => {
    if (!(await confirmDialog(t("clientIntake.confirmRevoke")))) return;
    try {
      await db.revokeClientIntakeLink(link.id);
      if (created?.id === link.id) setCreated(null);
      load();
    } catch (err) {
      notify(err.message || t("clientIntake.revokeError"));
    }
  };

  const refresh = () => load();

  return (
    <section className="card client-intake" aria-labelledby="client-intake-title">
      <div className="client-intake__head">
        <div>
          <h2 id="client-intake-title">{t("clientIntake.title")}</h2>
          <p className="form-hint">{t("clientIntake.hint", { days: INTAKE_VALID_DAYS })}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      <form className="client-intake__form" onSubmit={create}>
        <fieldset className="client-intake__types">
          <legend>{t("clientIntake.typeLabel")}</legend>
          {INTAKE_TYPES.map((value) => (
            <label key={value} className={`client-intake__type${type === value ? " is-on" : ""}`}>
              <input type="radio" name="intake-type" value={value} checked={type === value} onChange={() => setType(value)} />
              {t(`clients.${TYPE_KEY[value]}`)}
            </label>
          ))}
        </fieldset>
        <div className="form-field client-intake__label">
          <label htmlFor="intake-label">{t("clientIntake.labelLabel")}</label>
          <input id="intake-label" value={label} maxLength={INTAKE_LABEL_MAX} onChange={(e) => setLabel(e.target.value)} placeholder={t("clientIntake.labelPlaceholder")} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <span className="spinner" /> : null}
          {t("clientIntake.create")}
        </button>
      </form>

      {created && (
        <div className="client-intake__ready" role="status">
          <strong>{t("clientIntake.ready", { type: t(`clients.${TYPE_KEY[created.type]}`).toLowerCase() })}</strong>
          <input readOnly value={intakeUrl(siteOrigin(), created.token)} aria-label={t("clientIntake.linkAria")} onFocus={(e) => e.target.select()} />
          <LinkActions link={created} />
        </div>
      )}

      <div className="client-intake__list-head">
        <h3>{t("clientIntake.recent")}</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={refresh}>
          {t("clientIntake.refresh")}
        </button>
      </div>
      {links === null && <p className="form-hint">{t("common.loading")}</p>}
      {links?.length === 0 && <p className="form-hint">{t("clientIntake.empty")}</p>}
      {links?.length > 0 && (
        <ul className="client-intake__list">
          {links.map((link) => {
            const state = intakeState(link);
            return (
              <li key={link.id} className="client-intake__item">
                <div className="client-intake__item-main">
                  <strong>{link.client_name || link.label || t("clientIntake.noLabel")}</strong>
                  {freshIds.has(link.id) && <span className="badge client-intake__new">{t("clientIntake.new")}</span>}
                  <span className="form-hint">
                    {t(`clients.${TYPE_KEY[link.type]}`)} · {t("clientIntake.createdOn", { date: fmtDate(link.created_at) })}
                    {state === "pending" ? ` · ${t("clientIntake.expiresOn", { date: fmtDate(link.expires_at) })}` : ""}
                  </span>
                </div>
                <span className={`badge client-intake__state client-intake__state--${state}`}>{t(`clientIntake.state.${state}`)}</span>
                <div className="client-intake__item-actions">
                  {state === "pending" && (
                    <>
                      <LinkActions link={link} />
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => revoke(link)}>
                        {t("clientIntake.revoke")}
                      </button>
                    </>
                  )}
                  {state === "used" && link.client_id && (
                    <Link to={`/admin/clientes/${link.client_id}`} className="btn btn-outline btn-sm">
                      {t("clientIntake.openClient")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
