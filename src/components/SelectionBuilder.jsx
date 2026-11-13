import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { queries } from "../lib/queries";
import { useQuery } from "../lib/useQuery";
import { isOnline } from "../lib/offlineQueue";
import { isAvailable } from "../lib/alertMatch";
import { formatMXN, whatsappDigits, whatsappUrl } from "../lib/format";
import { matchingProperties } from "../lib/prospectMatch";
import { selectionShareMessage } from "../lib/propertyShare";
import { sendLink } from "../lib/prospectMessages";
import { MAX_SELECTION, NOTE_MAX, TITLE_MAX, defaultSelectionTitle, selectionUrl, suggestedPicks, togglePick } from "../lib/selections";
import "./PropertyProspectsModal.css";
import "./SendPropertyModal.css";
import "./SelectionBuilder.css";

const MAX_LISTED = 40; // propiedades que se dibujan a la vez en el selector (se afina con la búsqueda)
const MAX_RECIPIENTS = 6;
const OTHER = "other";
const NONE = [];

const normalize = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// «Armar selección»: el asesor elige varias propiedades (con un prospecto, las que le encajan vienen marcadas), escribe
// un mensaje opcional y crea UN enlace público (/seleccion/<token>) con todas, que manda por WhatsApp. Después puede ver
// la página como la verá el cliente (sin que cuente como apertura). Ver lib/selections.js y supabase/schema.sql.
//   prospect   — a quién va (en su ficha o tarjeta); sin él, se elige un prospecto o se escribe un número;
//   initialIds — propiedades marcadas de entrada (sin ellas, las mejores coincidencias del prospecto);
//   onSent(canal, selección) — se tocó «Enviar»: la pantalla de fondo ofrece registrar el contacto;
//   onClose — cierra la ventana.
export default function SelectionBuilder({ prospect = null, initialIds = null, onClose, onSent }) {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const propertiesQ = useQuery(queries.properties);
  const prospectsQ = useQuery(queries.prospects, { enabled: !prospect });
  const advisorsQ = useQuery(queries.advisors);
  const selectionsQ = useQuery(queries.selections);
  const properties = propertiesQ.data ?? NONE;
  const prospects = prospectsQ.data ?? NONE;

  const available = useMemo(() => properties.filter(isAvailable), [properties]);
  const matches = useMemo(() => (prospect ? matchingProperties(prospect, properties) : NONE), [prospect, properties]);
  const [ids, setIds] = useState(() => (initialIds ? initialIds.slice(0, MAX_SELECTION) : prospect ? suggestedPicks(matches) : []));
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState(() => defaultSelectionTitle(prospect?.name));
  const [titleEdited, setTitleEdited] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Con el prospecto de la ficha, las coincidencias llegan cuando carga la lista de propiedades: si todavía no se había
  // marcado nada ni el asesor tocó la lista, se marcan entonces.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (prospect && !initialIds && !touched && ids.length === 0 && matches.length > 0) setIds(suggestedPicks(matches));
  }, [prospect, initialIds, touched, ids.length, matches]);

  const chosenProspect = prospect || prospects.find((p) => p.id === recipientId) || null; // el prospecto al que va (si va a uno)
  const recipient = prospect
    ? prospect
    : recipientId === OTHER
      ? { name: "", phone, email: "" }
      : chosenProspect;
  const recipientName = recipient?.name || "";
  const advisorName = (advisorsQ.data ?? NONE).find((a) => a.id === advisorId)?.name || "";

  // El título de partida sigue al destinatario mientras el asesor no lo haya escrito él.
  useEffect(() => {
    if (!titleEdited) setTitle(defaultSelectionTitle(recipientName));
  }, [recipientName, titleEdited]);

  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const matchIds = useMemo(() => new Set(matches.map((p) => p.id)), [matches]);
  const picked = ids.map((id) => byId.get(id)).filter(Boolean);

  // Para elegir: primero las que le encajan al prospecto, luego las demás disponibles (las más nuevas primero).
  const choices = useMemo(() => {
    const q = normalize(query);
    const rank = (p) => (matchIds.has(p.id) ? 0 : 1);
    return available
      .filter((p) => !q || [p.title, p.code, p.zone].some((v) => normalize(v).includes(q)))
      .sort((a, b) => rank(a) - rank(b) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [available, query, matchIds]);

  const recipientChoices = useMemo(() => {
    const q = normalize(recipientQuery);
    const list = q ? prospects.filter((p) => [p.name, p.phone].some((v) => normalize(v).includes(q))) : prospects;
    return list.slice(0, MAX_RECIPIENTS);
  }, [prospects, recipientQuery]);

  const pick = (id) => {
    setTouched(true);
    setIds((current) => togglePick(current, id));
  };

  const create = async () => {
    setError("");
    if (ids.length === 0) {
      setError(t("selection.builder.needOne"));
      return;
    }
    if (!isOnline()) {
      setError(t("selection.builder.needOnline"));
      return;
    }
    setSaving(true);
    try {
      // A quién le escribe el cliente desde la página: el asesor que la arma o, si la arma la oficina, el del prospecto (sin
      // ninguno, la página usa el WhatsApp de la oficina).
      const record = await db.createSelection({ propertyIds: ids, title, note, advisorId: advisorId ?? chosenProspect?.advisor_id ?? null, prospectoId: chosenProspect?.id || null });
      selectionsQ.mutate((list) => [record, ...(list || [])]);
      setCreated(record);
      setText(selectionShareMessage({ url: selectionUrl(window.location.origin, record.token), count: record.property_ids.length, recipientName, advisorName }));
    } catch (err) {
      setError(err.message || t("selection.builder.createError"));
    } finally {
      setSaving(false);
    }
  };

  const url = created ? selectionUrl(window.location.origin, created.token) : "";
  // WhatsApp si hay un teléfono completo; si no, un correo (si lo tiene); si no, solo queda copiar el enlace.
  const hasPhone = whatsappDigits(recipient?.phone).length >= 10;
  const link =
    created && recipient ? (hasPhone ? whatsappUrl(recipient.phone, text) : sendLink({ email: recipient.email }, text, t("selection.builder.emailSubject"))) : null;
  const channel = link?.startsWith("http") ? "whatsapp" : "correo";

  const copy = async (what, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      try {
        window.prompt(t("detail.copyLinkManual"), value);
      } catch {
        // Sin portapapeles ni prompt: el enlace sigue a la vista en la ventana.
      }
    }
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("selection.builder.title")}>
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card selection-builder">
        <div className="match-modal__head">
          <h2>{created ? t("selection.builder.readyTitle") : t("selection.builder.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {!created ? (
          <>
            {prospect ? (
              <p className="form-hint">{t("selection.builder.forProspect", { name: prospect.name })}</p>
            ) : (
              <fieldset className="send-property__group">
                <legend>{t("selection.builder.recipient")}</legend>
                {prospects.length > 0 && (
                  <div className="form-field">
                    <input
                      type="search"
                      value={recipientQuery}
                      onChange={(e) => setRecipientQuery(e.target.value)}
                      placeholder={t("sendProperty.search")}
                      aria-label={t("sendProperty.search")}
                    />
                  </div>
                )}
                <div className="send-property__options" role="radiogroup" aria-label={t("selection.builder.recipient")}>
                  {recipientChoices.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={recipientId === p.id}
                      className={`send-property__option${recipientId === p.id ? " is-active" : ""}`}
                      onClick={() => setRecipientId(p.id)}
                    >
                      <strong>{p.name}</strong>
                      <span className="form-hint">{p.phone || t("sendProperty.noPhone")}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={recipientId === OTHER}
                    className={`send-property__option${recipientId === OTHER ? " is-active" : ""}`}
                    onClick={() => setRecipientId(OTHER)}
                  >
                    <strong>{t("sendProperty.otherNumber")}</strong>
                  </button>
                </div>
                {recipientId === OTHER && (
                  <div className="form-field">
                    <label htmlFor="selection-phone">{t("sendProperty.phone")}</label>
                    <input id="selection-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                )}
              </fieldset>
            )}

            <div className="form-field">
              <label htmlFor="selection-title">{t("selection.builder.titleLabel")}</label>
              <input
                id="selection-title"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleEdited(true);
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="selection-note">{t("selection.builder.noteLabel")}</label>
              <textarea id="selection-note" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("selection.builder.notePlaceholder")} />
            </div>

            <fieldset className="send-property__group">
              <legend>{t("selection.builder.properties")}</legend>
              <p className="form-hint" aria-live="polite">
                {t("selection.builder.picked", { count: ids.length, max: MAX_SELECTION })}
              </p>
              {picked.length > 0 && (
                <ul className="selection-builder__picked" aria-label={t("selection.builder.picked", { count: ids.length, max: MAX_SELECTION })}>
                  {picked.map((p) => (
                    <li key={p.id} className="selection-builder__chip">
                      <span>{p.title}</span>
                      <button type="button" aria-label={t("selection.builder.remove", { title: p.title })} onClick={() => pick(p.id)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="form-field">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("selection.builder.searchProps")}
                  aria-label={t("selection.builder.searchProps")}
                />
              </div>
              <ul className="selection-builder__choices">
                {choices.slice(0, MAX_LISTED).map((p) => {
                  const on = ids.includes(p.id);
                  const locked = !on && ids.length >= MAX_SELECTION;
                  return (
                    <li key={p.id}>
                      <label className={`selection-builder__choice${on ? " is-on" : ""}`}>
                        <input type="checkbox" checked={on} disabled={locked} onChange={() => pick(p.id)} aria-label={t("selection.builder.pick", { title: p.title })} />
                        <span className="selection-builder__choice-main">
                          <strong>{p.title}</strong>
                          <span className="form-hint">{[p.zone, formatMXN(p.price)].filter(Boolean).join(" · ")}</span>
                        </span>
                        {matchIds.has(p.id) && <span className="prospect-chip prospect-chip--match">{t("selection.builder.fits")}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {choices.length === 0 && <p className="form-hint">{t("selection.builder.noProps")}</p>}
              {choices.length > MAX_LISTED && <p className="form-hint">{t("selection.builder.refine", { count: choices.length - MAX_LISTED })}</p>}
              {ids.length >= MAX_SELECTION && <p className="form-hint">{t("selection.builder.maxReached", { max: MAX_SELECTION })}</p>}
            </fieldset>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="send-property__actions">
              <button type="button" className="btn btn-primary" onClick={create} disabled={saving || ids.length === 0}>
                {saving ? t("selection.builder.creating") : t("selection.builder.create", { count: ids.length })}
              </button>
              <span className="form-hint">{t("selection.builder.createHint")}</span>
            </div>
          </>
        ) : (
          <>
            <p className="form-hint">{t("selection.builder.readyHint", { count: created.property_ids.length })}</p>
            <div className="form-field">
              <label htmlFor="selection-url">{t("selection.builder.link")}</label>
              <input id="selection-url" readOnly value={url} onFocus={(e) => e.target.select()} />
            </div>
            <div className="form-field">
              <label htmlFor="selection-text">{t("sendProperty.message")}</label>
              <textarea id="selection-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="send-property__actions">
              {link ? (
                <a
                  className="btn btn-primary"
                  href={link}
                  target={link.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  onClick={() => onSent?.(channel, created)}
                >
                  {channel === "correo" ? t("selection.builder.sendEmail") : t("sendProperty.openWhatsApp")}
                </a>
              ) : (
                <span className="form-hint">{t("sendProperty.needRecipient")}</span>
              )}
              <button type="button" className="btn btn-outline" onClick={() => copy("text", text)}>
                {copied === "text" ? t("sendProperty.copied") : t("sendProperty.copy")}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => copy("url", url)}>
                {copied === "url" ? t("sendProperty.copied") : t("selection.builder.copyLink")}
              </button>
              <a className="btn btn-outline" href={`${url}?vista=asesor`} target="_blank" rel="noopener noreferrer">
                {t("selection.builder.preview")}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
