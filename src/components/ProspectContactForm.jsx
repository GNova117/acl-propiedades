import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CONTACT_CHANNELS, FOLLOWUP_KEEP, FOLLOWUP_NONE, followupArg, validateContact } from "../lib/prospectContacts";
import { FOLLOWUP_OPTIONS, addDaysISO, isOpenStage, todayISO } from "../lib/prospects";
import "./ProspectContactForm.css";

// "Registrar contacto" de la tarjeta de un prospecto: canal (obligatorio), nota
// corta y, en una etapa abierta, cuándo es el siguiente seguimiento (también
// obligatorio: una fecha, "dejar la que tiene" o "sin fecha" — así el prospecto
// no se queda sin fecha por descuido). En cerrado y perdido no hay seguimiento.
// No preselecciona un canal por su cuenta (se guardaría un dato equivocado sin
// que nadie lo note); solo cuando el asesor acaba de mandar un WhatsApp o un
// correo desde los mensajes rápidos, `defaultChannel` ya lo trae elegido.
export default function ProspectContactForm({ prospect, defaultChannel = "", saving = false, error = "", onSave, onCancel }) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState(defaultChannel);
  const [note, setNote] = useState("");
  // "" (sin elegir) | FOLLOWUP_KEEP | FOLLOWUP_NONE | una fecha YYYY-MM-DD.
  const [followup, setFollowup] = useState("");
  const [errors, setErrors] = useState({});

  const askFollowup = isOpenStage(prospect.stage);
  const keepDate = prospect.next_followup_at && prospect.next_followup_at > todayISO() ? prospect.next_followup_at : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = validateContact({ channel, followup, askFollowup });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSave({ channel, note, nextFollowup: askFollowup ? followupArg(followup) : undefined });
  };

  // Una opción de seguimiento: se vuelve a pulsar para quitarla.
  const followupChip = (value, label) => (
    <button
      key={value}
      type="button"
      className={`contact-form__chip${followup === value ? " is-active" : ""}`}
      aria-pressed={followup === value}
      onClick={() => setFollowup(followup === value ? "" : value)}
    >
      {label}
    </button>
  );

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate aria-label={t("prospects.logContact")}>
      <fieldset className="contact-form__group">
        <legend>{t("prospects.contact.channel")}</legend>
        <div className="contact-form__chips">
          {CONTACT_CHANNELS.map((c) => (
            <label key={c} className={`contact-form__chip${channel === c ? " is-active" : ""}`}>
              <input type="radio" name={`contact-channel-${prospect.id}`} value={c} checked={channel === c} onChange={() => setChannel(c)} />
              {t(`prospects.contact.channels.${c}`)}
            </label>
          ))}
        </div>
        {errors.channel && <span className="form-error">{t(errors.channel)}</span>}
      </fieldset>

      <div className="form-field">
        <label htmlFor={`contact-note-${prospect.id}`}>{t("prospects.contact.note")}</label>
        <input
          id={`contact-note-${prospect.id}`}
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("prospects.contact.notePlaceholder")}
        />
      </div>

      {askFollowup && (
        <fieldset className="contact-form__group">
          <legend>{t("prospects.nextFollowupQuestion")}</legend>
          <div className="contact-form__chips">
            {FOLLOWUP_OPTIONS.map((option) => followupChip(addDaysISO(option.days), t(`prospects.followupOptions.${option.key}`)))}
            {keepDate &&
              followupChip(
                FOLLOWUP_KEEP,
                t("prospects.keepFollowup", { date: new Date(`${keepDate}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) })
              )}
            {followupChip(FOLLOWUP_NONE, t("prospects.noFollowup"))}
            <input
              type="date"
              min={todayISO()}
              value={/^\d{4}-\d{2}-\d{2}$/.test(followup) ? followup : ""}
              onChange={(e) => setFollowup(e.target.value)}
              aria-label={t("prospects.form.nextFollowup")}
            />
          </div>
          {errors.followup && <span className="form-error">{t(errors.followup)}</span>}
        </fieldset>
      )}

      {error && <span className="form-error">{error}</span>}

      <div className="contact-form__actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="spinner" /> : null}
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}
