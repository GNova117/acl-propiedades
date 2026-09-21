import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./InlineRename.css";

// Título de una tarjeta del admin con un botón "Editar" que lo vuelve un campo
// de texto. `value` es lo que se muestra; `editValue` es con lo que arranca el
// campo cuando difiere (los tipos de fábrica se muestran traducidos, pero se
// edita el nombre guardado). `onSave(nuevoNombre)` puede lanzar un Error: su
// mensaje se muestra y el campo sigue abierto para corregirlo.
export default function InlineRename({ value, editValue = value, onSave, label }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(editValue);
    setEditing(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = draft.trim();
    if (!next || next === editValue) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      window.alert(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="inline-rename">
        <h3>{value}</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={start}>
          {t("common.edit")}
        </button>
      </div>
    );
  }

  return (
    <form className="inline-rename inline-rename--editing" onSubmit={handleSubmit}>
      <input aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !draft.trim()}>
        {saving ? <span className="spinner" /> : t("common.save")}
      </button>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)} disabled={saving}>
        {t("common.cancel")}
      </button>
    </form>
  );
}
