import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import "./AgendaReagendarModal.css";

// Reagendar una cita desde la lista de Agenda, sin tener que entrar a
// Editar: pide la fecha/hora nueva (obligatoria) y un motivo opcional —
// la cita vuelve a "pendiente" y los avisos ya mandados se limpian (ver
// reagendarAgendaCita en dataStore).
export default function AgendaReagendarModal({ cita, onClose, onSaved }) {
  const { t } = useTranslation();
  const [fecha, setFecha] = useState(cita.fecha);
  const [hora, setHora] = useState(cita.hora ? cita.hora.slice(0, 5) : "");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fecha) return;
    setSaving(true);
    setError("");
    try {
      const updated = await db.reagendarAgendaCita(cita.id, { fecha, hora, motivo });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || "Error al reagendar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="agenda-reagendar-modal">
      <form className="agenda-reagendar-modal__card card" onSubmit={handleSubmit}>
        <div className="agenda-reagendar-modal__header">
          <div>
            <h3>{t("agenda.reschedule")}</h3>
            <p className="form-hint">{cita.titulo}</p>
          </div>
          <button type="button" className="agenda-reagendar-modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <p className="form-hint">{t("agenda.rescheduleHint")}</p>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="reagendar-fecha">{t("agenda.date")}</label>
            <input id="reagendar-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="reagendar-hora">{t("agenda.time")}</label>
            <input id="reagendar-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="reagendar-motivo">{t("agenda.rescheduleReason")}</label>
          <textarea
            id="reagendar-motivo"
            rows={2}
            placeholder={t("agenda.rescheduleReasonPlaceholder")}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("agenda.rescheduleSubmit")}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
