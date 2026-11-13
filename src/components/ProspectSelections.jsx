import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { queries } from "../lib/queries";
import { useQuery } from "../lib/useQuery";
import { whatsappDigits, whatsappUrl } from "../lib/format";
import { selectionShareMessage } from "../lib/propertyShare";
import { agoText, defaultSelectionTitle, selectionState, selectionUrl, selectionsFor } from "../lib/selections";

const NONE = [];

// «Selecciones enviadas» de la ficha de un prospecto: cada selección de propiedades que se le mandó, con lo que más
// importa para el seguimiento —si ya la abrió, cuándo y cuántas veces— y lo que se hace con ella: copiar el enlace,
// reenviarlo, verla como la ve el cliente (sin que cuente como apertura) o desactivarla. `onNew`: abre «Armar selección»;
// `onSent(canal)`: se reenvió por WhatsApp (la ficha ofrece registrar el contacto). Lee del caché compartido de
// selecciones (queries.selections): al armar una nueva aparece al instante.
export default function ProspectSelections({ prospect, advisorName = "", onNew, onSent }) {
  const { t, i18n } = useTranslation();
  const selectionsQ = useQuery(queries.selections);
  const mine = useMemo(() => selectionsFor(prospect.id, selectionsQ.data ?? NONE), [prospect.id, selectionsQ.data]);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const locale = i18n.language === "en" ? "en-US" : "es-MX";
  const day = (value) => new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const canWhatsApp = whatsappDigits(prospect.phone).length >= 10;

  const copyLink = async (selection) => {
    const url = selectionUrl(window.location.origin, selection.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(selection.id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      try {
        window.prompt(t("detail.copyLinkManual"), url);
      } catch {
        // Sin portapapeles ni prompt: el asesor puede abrir «Ver» y copiar la dirección.
      }
    }
  };

  const revoke = async (selection) => {
    if (!window.confirm(t("selection.list.confirmRevoke"))) return;
    setError("");
    try {
      const updated = await db.revokeSelection(selection.id);
      selectionsQ.mutate((list) => (list || []).map((s) => (s.id === selection.id ? { ...s, ...updated } : s)));
    } catch (err) {
      setError(err.message || t("selection.list.revokeError"));
    }
  };

  return (
    <section className="card prospect-selections" aria-label={t("selection.list.title")}>
      <div className="prospect-selections__head">
        <h2>{t("selection.list.title")}</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={onNew}>
          {t("selection.list.new")}
        </button>
      </div>
      {mine.length === 0 && <p className="form-hint">{t("selection.list.empty")}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <ul className="prospect-selections__list">
        {mine.map((selection) => {
          const state = selectionState(selection);
          const url = selectionUrl(window.location.origin, selection.token);
          const active = state === "sent" || state === "opened";
          const resend =
            active && canWhatsApp
              ? whatsappUrl(prospect.phone, selectionShareMessage({ url, count: selection.property_ids.length, recipientName: prospect.name, advisorName }))
              : null;
          return (
            <li key={selection.id} className="prospect-selections__item" data-state={state}>
              <div>
                <strong>{selection.title || defaultSelectionTitle(prospect.name)}</strong>
                <span className="form-hint">
                  {" · "}
                  {t("selection.list.properties", { count: selection.property_ids.length })}
                  {" · "}
                  {t("selection.list.sentOn", { date: day(selection.created_at) })}
                </span>
              </div>
              <div className="prospect-selections__state">
                <span className={`prospect-chip${state === "opened" ? " prospect-chip--today" : ""}`}>
                  {state === "opened"
                    ? `${t("selection.list.state.opened", { ago: agoText(selection.last_opened_at, i18n.language) })} · ${t("selection.list.times", { count: selection.open_count })}`
                    : t(`selection.list.state.${state}`)}
                </span>
                {active && <span className="form-hint">{t("selection.list.validUntil", { date: day(selection.expires_at) })}</span>}
              </div>
              <div className="prospect-selections__actions">
                {active && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => copyLink(selection)}>
                    {copied === selection.id ? t("selection.list.copied") : t("selection.list.copyLink")}
                  </button>
                )}
                {resend && (
                  <a className="btn btn-outline btn-sm" href={resend} target="_blank" rel="noopener noreferrer" onClick={() => onSent?.("whatsapp")}>
                    {t("selection.list.resend")}
                  </a>
                )}
                {active && (
                  <a className="btn btn-outline btn-sm" href={`${url}?vista=asesor`} target="_blank" rel="noopener noreferrer">
                    {t("selection.list.view")}
                  </a>
                )}
                {active && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => revoke(selection)}>
                    {t("selection.list.revoke")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
