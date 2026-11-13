import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { useAuth } from "../context/AuthContext";
import { PROSPECT_STAGES } from "../lib/prospects";
import { contactAgoText, convertProspectToClient, quickTemplates, telHref, whatsappLink } from "../lib/prospectActions";
import { prospectToCitaPrefill } from "../lib/prospectAgenda";
import { criteriaSummary, matchingProperties } from "../lib/prospectMatch";
import { useProspectContact } from "../lib/useProspectContact";
import QuickReplyButton from "./QuickReplyButton";
import ProspectContactForm from "./ProspectContactForm";
import ProspectMatches from "./ProspectMatches";
import { FollowChip, UnattendedChip } from "./ProspectChips";

// Ficha de un prospecto: lo que hay que saber de él y lo que se le hace, sin
// pasar por el formulario de edición (que queda plegado debajo). Resumen
// (teléfono, qué busca, última vez que se le contactó, seguimiento, notas) y las
// acciones de siempre: mensaje rápido, llamar, WhatsApp, registrar contacto,
// agendar una cita ya llena, cambiar de etapa y convertir en cliente.
// `onUpdated(prospecto)`: la pantalla de fondo se actualiza con el cambio.
export default function ProspectProfile({ prospect: p, properties, advisors, onUpdated }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { advisorId, hasSection } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const contact = useProspectContact({ onUpdated });

  // Al llegar desde «Llamar» o «WhatsApp» de la búsqueda (state.logContact = canal), «Registrar contacto» ya
  // queda abierto con ese canal: al regresar de la llamada o del chat solo falta el resultado.
  useEffect(() => {
    const channel = location.state?.logContact;
    if (!channel) return;
    contact.open(p, channel, true);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const property = properties.find((x) => x.id === p.property_id) || null;
  const advisorName = advisors.find((a) => a.id === p.advisor_id)?.name || "";
  const propertyTitle = property?.title || "";
  const matches = useMemo(() => matchingProperties(p, properties), [p, properties]);
  const call = telHref(p.phone);
  const wa = whatsappLink(p.phone);
  const criteria = criteriaSummary(p.search_criteria, t);
  const looking = [p.looking_for, criteria].filter(Boolean).join(" · ");

  const changeStage = async (stage) => {
    setBusy(true);
    setError("");
    try {
      onUpdated(await db.updateProspect(p.id, { stage, ...(stage === "perdido" ? {} : { lost_reason: null }) }));
    } catch (err) {
      setError(err.message || t("prospects.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    setBusy(true);
    setError("");
    try {
      const clientId = await convertProspectToClient(db, p, (existing) => window.confirm(t("prospects.convertExisting", { name: existing.name })));
      if (clientId) navigate(`/admin/clientes/${clientId}`);
    } catch (err) {
      setError(err.message || t("prospects.convertError"));
    } finally {
      setBusy(false);
    }
  };

  const fact = (label, value) =>
    value ? (
      <>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </>
    ) : null;

  return (
    <section className="card prospect-profile" aria-label={t("prospects.profile.summary")}>
      <div className="prospect-profile__head">
        <div>
          <h1>{p.name}</h1>
          <div className="prospect-profile__chips">
            <span className="prospect-chip">{t(`prospects.stages.${p.stage}`)}</span>
            {p.source && p.source !== "manual" && <span className="prospect-chip">{t(`prospects.sources.${p.source}`)}</span>}
            <UnattendedChip prospect={p} />
            <FollowChip prospect={p} />
          </div>
        </div>
        <Link to="/admin/prospectos" className="btn btn-outline btn-sm">
          {t("prospects.profile.back")}
        </Link>
      </div>

      <dl className="prospect-profile__facts">
        {fact(t("prospects.profile.phone"), p.phone && <a href={call || undefined}>{p.phone}</a>)}
        {fact(t("prospects.profile.email"), p.email && <a href={`mailto:${p.email}`}>{p.email}</a>)}
        {fact(
          t("prospects.profile.property"),
          property && (
            <a href={`/propiedades/${property.id}`} target="_blank" rel="noopener noreferrer">
              {property.title}
            </a>
          )
        )}
        {fact(t("prospects.profile.lookingFor"), looking)}
        {fact(t("prospects.profile.lastContact"), contactAgoText(p, t))}
        {fact(
          t("prospects.profile.nextFollowup"),
          p.next_followup_at && new Date(`${p.next_followup_at}T00:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
        )}
        {fact(t("prospects.profile.advisor"), advisorId == null && advisorName)}
        {fact(t("prospects.profile.created"), p.created_at && new Date(p.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }))}
        {p.stage === "perdido" && fact(t("prospects.profile.lostReason"), p.lost_reason)}
      </dl>

      {p.notes && (
        <p className="prospect-profile__notes">
          <strong>{t("prospects.profile.notes")}:</strong> {p.notes}
        </p>
      )}

      <div className="prospect-card__actions prospect-profile__actions">
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
        {wa && (
          <a className="btn btn-outline btn-sm" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => contact.open(p, "whatsapp", true)}>
            WhatsApp
          </a>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => contact.open(p)} aria-expanded={contact.isOpenFor(p.id)}>
          {t("prospects.logContact")}
        </button>
        {hasSection("agenda") && (
          <Link
            to="/admin/agenda/nueva"
            state={{ from: `/admin/prospectos/${p.id}`, prefill: prospectToCitaPrefill(p, { propertyTitle, t }) }}
            className="btn btn-primary btn-sm"
          >
            {t("prospects.schedule")}
          </Link>
        )}
        {p.client_id ? (
          <Link to={`/admin/clientes/${p.client_id}`} className="btn btn-outline btn-sm">
            {t("prospects.viewClient")}
          </Link>
        ) : (
          hasSection("clientes") && (
            <button type="button" className="btn btn-outline btn-sm" onClick={convert} disabled={busy}>
              {t("prospects.convert")}
            </button>
          )
        )}
        <select value={p.stage} onChange={(e) => changeStage(e.target.value)} disabled={busy} aria-label={t("prospects.form.stage")}>
          {PROSPECT_STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`prospects.stages.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

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

      <ProspectMatches prospect={p} matches={matches} advisorName={advisorName} onSent={(channel) => contact.open(p, channel, true)} />
    </section>
  );
}
