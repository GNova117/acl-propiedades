import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CONTACT_CHANNELS, FOLLOWUP_PRESET_DAYS, addDaysISO, validateContact } from "../lib/prospectContacts";
import { followUpState, todayISO } from "../lib/prospects";
import "./ProspectContactForm.css";

// "Registrar contacto" de la tarjeta de un prospecto: canal (obligatorio), nota
// corta y, si se quiere, la fecha del próximo seguimiento. No preselecciona un
// canal por su cuenta (se guardaría un dato equivocado sin que nadie lo note);
// solo cuando el asesor acaba de mandar un WhatsApp o un correo desde las
// plantillas, `defaultChannel` ya lo trae elegido y basta con "Guardar".
export default function ProspectContactForm({ prospect, defaultChannel = "", saving = false, error = "", onSave, onCancel }) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState(defaultChannel);
  const [note, setNote] = useState("");
  const [nextFollowupAt, setNextFollowupAt] = useState("");
  const [errors, setErrors] = useState({});

  const dueFollowUp = Boolean(followUpState(prospect));
  const presets = FOLLOWUP_PRESET_DAYS.map((days) => ({ days, date: addDaysISO(days) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = validateContact({ channel, nextFollowupAt });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSave({ channel, note, nextFollowupAt });
  };

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

      <fieldset className="contact-form__group">
        <legend>{t("prospects.contact.nextFollowup")}</legend>
        <div className="contact-form__chips">
          {presets.map(({ days, date }) => (
            <button
              key={days}
              type="button"
              className={`contact-form__chip${nextFollowupAt === date ? " is-active" : ""}`}
              aria-pressed={nextFollowupAt === date}
              onClick={() => setNextFollowupAt(nextFollowupAt === date ? "" : date)}
            >
              {t(`prospects.contact.in${days}`)}
            </button>
          ))}
          <input
            type="date"
            min={todayISO()}
            value={nextFollowupAt}
            onChange={(e) => setNextFollowupAt(e.target.value)}
            aria-label={t("prospects.contact.nextFollowup")}
          />
        </div>
        {errors.nextFollowupAt && <span className="form-error">{t(errors.nextFollowupAt)}</span>}
        {dueFollowUp && !nextFollowupAt && <p className="form-hint">{t("prospects.contact.dueHint")}</p>}
      </fieldset>

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
