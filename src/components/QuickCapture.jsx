import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { quickProspectFields, validateQuickProspect } from "../lib/quickProspect";
import { mutate } from "../lib/dataCache";
import { queries } from "../lib/queries";
import DuplicateWarning from "./DuplicateWarning";
import "./QuickCapture.css";

const EMPTY = { name: "", phone: "", lookingFor: "", pasted: "" };

// Botón flotante "+" del panel: lo que un asesor crea todo el día, a un toque
// desde cualquier pantalla. Abre un menú con lo que el rol puede hacer —un
// prospecto rápido, una cita nueva o registrar una visita—; con una sola opción
// no hay menú y el botón va directo a ella.
//
// El prospecto rápido (la hoja de abajo) captura a alguien en segundos (típico:
// el cliente que acabas de conocer en la calle o en una visita). Pide solo
// nombre y teléfono; "qué busca" y un campo para pegar el mensaje de WhatsApp
// (de ahí se saca el teléfono si falta) son opcionales. El prospecto queda en
// "Nuevo" y con el asesor que lo capturó; el resto se completa después en su
// ficha. La cita y la visita abren sus formularios y, al cancelar, regresan a
// la pantalla donde estabas (`state.from`).
export default function QuickCapture() {
  const { t } = useTranslation();
  const { advisorId, hasSection } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(null);
  // Coincidencias con un prospecto o cliente que ya existe; mientras haya, el
  // botón pasa a "Guardar de todos modos" (el aviso no bloquea).
  const [duplicates, setDuplicates] = useState([]);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Cambiar de pantalla (también desde la barra de abajo) cierra el menú.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open && !saved) nameRef.current?.focus();
  }, [open, saved]);

  const reset = () => {
    setForm(EMPTY);
    setErrors({});
    setSaveError("");
    setSaved(null);
    setDuplicates([]);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    // Si cambia el teléfono o el mensaje (de donde sale el teléfono), el aviso ya no aplica.
    if (key === "phone" || key === "pasted") setDuplicates([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateQuickProspect(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const fields = quickProspectFields(form, { advisorId });
      if (duplicates.length === 0) {
        const found = await db.findContactDuplicates({ phone: fields.phone, email: fields.email });
        if (found.length > 0) {
          setDuplicates(found);
          return;
        }
      }
      const record = await db.addProspect(fields);
      // Si la lista de prospectos ya está cargada, el nuevo aparece en ella sin esperar a pedirla otra vez.
      mutate(queries.prospects.key, (prev) => [record, ...prev]);
      setSaved(record);
    } catch (err) {
      setSaveError(err.message || t("quickCapture.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // Lo que este rol puede crear (cada apartado, con el mismo permiso que su pantalla).
  const actions = [
    hasSection("prospectos") && { key: "prospect", label: t("quickCapture.open") },
    hasSection("agenda") && { key: "appointment", label: t("quickCapture.newAppointment"), to: "/admin/agenda/nueva" },
    hasSection("visitas") && { key: "visit", label: t("quickCapture.logVisit"), to: "/admin/visitas/nueva" },
  ].filter(Boolean);
  if (actions.length === 0) return null;

  const single = actions.length === 1 ? actions[0] : null;
  const fabLabel = single ? single.label : t("quickCapture.menu");
  const handleFab = () => {
    if (!single) setMenuOpen((v) => !v);
    else if (single.to) navigate(single.to, { state: { from: pathname } });
    else setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="quick-capture__fab"
        onClick={handleFab}
        aria-label={fabLabel}
        title={fabLabel}
        aria-haspopup={single ? undefined : "menu"}
        aria-expanded={single ? undefined : menuOpen}
      >
        <span aria-hidden="true">+</span>
      </button>

      {menuOpen && (
        <>
          <div className="quick-capture__scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="quick-capture__menu" role="menu" aria-label={t("quickCapture.menu")}>
            {actions.map((action) =>
              action.to ? (
                <Link key={action.key} role="menuitem" className="quick-capture__menu-item" to={action.to} state={{ from: pathname }} onClick={() => setMenuOpen(false)}>
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className="quick-capture__menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpen(true);
                  }}
                >
                  {action.label}
                </button>
              )
            )}
          </div>
        </>
      )}

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
                <DuplicateWarning duplicates={duplicates} onOpen={close} />
                {saveError && <p className="form-error" role="alert">{saveError}</p>}
                <div className="quick-capture__actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <span className="spinner" /> : null}
                    {duplicates.length > 0 ? t("duplicates.saveAnyway") : t("quickCapture.save")}
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
