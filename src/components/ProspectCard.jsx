import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PROSPECT_STAGES } from "../lib/prospects";
import { POSTSALE_STEPS, postsaleDue, postsaleMessage } from "../lib/postsale";
import { contactAgoText, quickTemplates, telHref, whatsappLink } from "../lib/prospectActions";
import { prospectToCitaPrefill } from "../lib/prospectAgenda";
import QuickReplyButton from "./QuickReplyButton";
import ProspectContactForm from "./ProspectContactForm";
import ProspectMatches from "./ProspectMatches";
import { FollowChip, SelectionChip, UnattendedChip } from "./ProspectChips";

// Tarjeta de un prospecto en el tablero de Prospectos. Lo que se hace casi
// siempre está a la vista —mensaje rápido y llamar, que al regresar abren solos
// "Registrar contacto" con el canal ya elegido— y lo demás (cambiar de etapa,
// agendar, ficha, convertir en cliente, eliminar) va tras «Más», para que en el
// teléfono cada tarjeta ocupe poco y lo destructivo no quede junto a lo de
// todos los días. `contact`: el estado de useProspectContact del tablero. En modo
// «Seleccionar» (`selectable`) la tarjeta trae su casilla para las acciones en lote. `drag` ({ onStart(id), onEnd }): en computadora
// la tarjeta se puede arrastrar a otra columna del tablero para cambiar de etapa (null = no se arrastra, como en el teléfono).
export default function ProspectCard({
  prospect: p,
  seesAll,
  advisorName,
  propertyTitle,
  matches,
  history,
  busy,
  canClients,
  canAgenda,
  contact,
  onStage,
  onConvert,
  onDelete,
  onPostsaleDone,
  selectable = false,
  selected = false,
  onToggleSelect,
  selections,
  drag = null,
}) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const wa = whatsappLink(p.phone);
  const call = telHref(p.phone);
  const due = p.stage === "cerrado" ? postsaleDue(p, history) : null;
  const step = due ? POSTSALE_STEPS.find((s) => s.key === due.key) : null;

  return (
    <article
      className={`card prospect-card${selected ? " is-selected" : ""}${drag ? " is-draggable" : ""}`}
      draggable={Boolean(drag)}
      onDragStart={
        drag
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", p.id);
              drag.onStart(p.id);
            }
          : undefined
      }
      onDragEnd={drag ? drag.onEnd : undefined}
      data-prospect={p.id}
    >
      <div className="prospect-card__head">
        {selectable && (
          <input
            type="checkbox"
            className="prospect-card__pick"
            checked={selected}
            onChange={() => onToggleSelect(p.id)}
            aria-label={t("prospects.bulk.pick", { name: p.name })}
          />
        )}
        <Link to={`/admin/prospectos/${p.id}`} className="prospect-card__name">
          {p.name}
        </Link>
        {p.source && p.source !== "manual" && <span className="prospect-chip">{t(`prospects.sources.${p.source}`)}</span>}
      </div>
      {p.phone && (
        <p className="prospect-card__line">
          <a href={call || undefined}>{p.phone}</a>
          {wa && (
            <>
              {" · "}
              <a href={wa} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </>
          )}
        </p>
      )}
      {p.property_id && propertyTitle && <p className="prospect-card__line">{propertyTitle}</p>}
      {p.looking_for && <p className="prospect-card__line form-hint">{p.looking_for}</p>}
      {p.stage === "perdido" && p.lost_reason && <p className="prospect-card__line form-hint">{p.lost_reason}</p>}
      <p className="prospect-card__meta">
        {contactAgoText(p, t)}
        {seesAll && advisorName ? ` · ${advisorName}` : ""}
      </p>
      <UnattendedChip prospect={p} />
      <FollowChip prospect={p} />
      <SelectionChip prospect={p} selections={selections} />
      {due && (
        <div className="prospect-postsale">
          <span className="prospect-chip prospect-chip--today">{t(`prospects.postsale.step${due.key}`, { days: due.since })}</span>
          {wa && (
            <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`${wa}?text=${encodeURIComponent(postsaleMessage(p, due.key, propertyTitle))}`}>
              {t("prospects.postsale.write")}
            </a>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onPostsaleDone(p, step)} disabled={busy}>
            {t("prospects.postsale.done")}
          </button>
        </div>
      )}
      <ProspectMatches prospect={p} matches={matches} advisorName={advisorName} onSent={(channel) => contact.open(p, channel, true)} />
      <div className="prospect-card__actions">
        <QuickReplyButton
          templates={quickTemplates(p, { propertyTitle, advisorName, origin: window.location.origin, t })}
          phone={p.phone}
          email={p.email}
          emailSubject="ACL Propiedades"
          label={t("prospects.templates.label")}
          recommendedLabel={t("prospects.templates.forStage", { stage: t(`prospects.stages.${p.stage}`) })}
          othersLabel={t("prospects.templates.others")}
          onSend={(_template, channel) => contact.open(p, channel, true)}
        />
        {call && (
          <a className="btn btn-outline btn-sm" href={call} onClick={() => contact.open(p, "llamada", true)}>
            {t("myDay.call")}
          </a>
        )}
        <details className="prospect-more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
          <summary className="btn btn-outline btn-sm">{t("prospects.more")}</summary>
          <div className="prospect-more__panel">
            <select value={p.stage} onChange={(e) => onStage(p, e.target.value)} disabled={busy} aria-label={t("prospects.form.stage")}>
              {PROSPECT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`prospects.stages.${s}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setMoreOpen(false);
                contact.open(p);
              }}
              aria-expanded={contact.isOpenFor(p.id)}
              disabled={busy}
            >
              {t("prospects.logContact")}
            </button>
            {canAgenda && (
              <Link
                to="/admin/agenda/nueva"
                state={{ from: "/admin/prospectos", prefill: prospectToCitaPrefill(p, { propertyTitle, t }) }}
                className="btn btn-outline btn-sm"
              >
                {t("prospects.schedule")}
              </Link>
            )}
            <Link to={`/admin/prospectos/${p.id}`} className="btn btn-outline btn-sm">
              {t("prospects.openProfile")}
            </Link>
            {p.client_id ? (
              <Link to={`/admin/clientes/${p.client_id}`} className="btn btn-outline btn-sm">
                {t("prospects.viewClient")}
              </Link>
            ) : (
              canClients && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => onConvert(p)} disabled={busy}>
                  {t("prospects.convert")}
                </button>
              )
            )}
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(p)} disabled={busy}>
              {t("common.delete")}
            </button>
          </div>
        </details>
      </div>
      {contact.isOpenFor(p.id) && (
        <ProspectContactForm
          key={`${p.id}-${contact.target.channel}`}
          prospect={p}
          defaultChannel={contact.target.channel}
          saving={contact.saving}
          error={contact.error}
          onSave={(values) => contact.save(p, values)}
          onCancel={contact.close}
        />
      )}
    </article>
  );
}
