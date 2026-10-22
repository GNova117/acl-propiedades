import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { quickProspectFields, validateQuickProspect } from "../lib/quickProspect";
import "./QuickCapture.css";

const EMPTY = { name: "", phone: "", lookingFor: "", pasted: "" };

// Botón flotante "+" del panel: captura un prospecto en segundos desde
// cualquier pantalla (típico: el cliente que acabas de conocer en la calle o en
// una visita). Pide solo nombre y teléfono; "qué busca" y un campo para pegar
// el mensaje de WhatsApp (de ahí se saca el teléfono si falta) son opcionales.
// El prospecto queda en "Nuevo" y con el asesor que lo capturó; el resto se
// completa después en su ficha.
export default function QuickCapture() {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open && !saved) nameRef.current?.focus();
  }, [open, saved]);

  const reset = () => {
    setForm(EMPTY);
    setErrors({});
    setSaveError("");
    setSaved(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateQuickProspect(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const record = await db.addProspect(quickProspectFields(form, { advisorId }));
      setSaved(record);
    } catch (err) {
      setSaveError(err.message || t("quickCapture.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" className="quick-capture__fab" onClick={() => setOpen(true)} aria-label={t("quickCapture.open")} title={t("quickCapture.open")}>
        <span aria-hidden="true">+</span>
      </button>

      {open && (
        <div className="quick-capture" role="dialog" aria-modal="true" aria-label={t("quickCapture.title")}>
          <div className="quick-capture__backdrop" onClick={close} aria-hidden="true" />
          <div className="quick-capture__sheet card">
            <div className="quick-capture__head">
              <h2>{t("quickCapture.title")}</h2>
              <button type="button" className="btn btn-outline btn-sm" onClick={close}>
                {t("common.close")}
              </button>
            </div>

            {saved ? (
              <div className="quick-capture__done" role="status">
                <p>
                  <strong>{t("quickCapture.saved", { name: saved.name })}</strong>
                </p>
                <div className="quick-capture__actions">
                  <Link to={`/admin/prospectos/${saved.id}`} className="btn btn-primary" onClick={close}>
                    {t("quickCapture.openProspect")}
                  </Link>
                  <button type="button" className="btn btn-outline" onClick={reset}>
                    {t("quickCapture.addAnother")}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <p className="form-hint">{t("quickCapture.hint")}</p>
                <div className="form-field">
                  <label htmlFor="qc-name">{t("quickCapture.name")}</label>
                  <input id="qc-name" ref={nameRef} type="text" autoComplete="off" value={form.name} onChange={setField("name")} />
                  {errors.name && <span className="form-error">{t(errors.name)}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="qc-phone">{t("quickCapture.phone")}</label>
                  <input id="qc-phone" type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={setField("phone")} />
                  {errors.phone && <span className="form-error">{t(errors.phone)}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="qc-looking">{t("quickCapture.lookingFor")}</label>
                  <input id="qc-looking" type="text" value={form.lookingFor} onChange={setField("lookingFor")} placeholder={t("quickCapture.lookingForPlaceholder")} />
                </div>
                <div className="form-field">
                  <label htmlFor="qc-pasted">{t("quickCapture.pasted")}</label>
                  <textarea id="qc-pasted" rows={3} value={form.pasted} onChange={setField("pasted")} />
                  <span className="form-hint">{t("quickCapture.pastedHint")}</span>
                </div>
                {saveError && <p className="form-error" role="alert">{saveError}</p>}
                <div className="quick-capture__actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <span className="spinner" /> : null}
                    {t("quickCapture.save")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
