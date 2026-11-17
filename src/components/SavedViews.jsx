import { useState } from "react";
import { useTranslation } from "react-i18next";
import { addView, hasActiveFilters, loadViews, removeView, saveViews } from "../lib/savedViews";
import "./SavedViews.css";
import { confirmDialog } from "../lib/toast";

// «Mis vistas»: filtros guardados de una lista, a un toque. `list` (clave de la lista), `schema` (qué campos entran),
// `current` (los filtros puestos ahora), `defaults` (valor «sin filtro» de los que no son "" ni false) y
// `onApply(filtros)` (pone esos filtros; los campos que la vista no trae vuelven a su valor inicial en quien llama).
// Se guardan en este dispositivo.
export default function SavedViews({ list, schema, current, defaults, onApply }) {
  const { t } = useTranslation();
  const [views, setViews] = useState(() => loadViews(list, schema));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const persist = (next) => {
    setViews(next);
    saveViews(list, next);
  };

  const submit = async (e) => {
    e.preventDefault();
    let result = addView(views, name, current, schema);
    if (result.error === "exists" && await confirmDialog(t("savedViews.confirmReplace", { name: name.trim() }))) result = addView(views, name, current, schema, { replace: true });
    if (result.error) {
      if (result.error !== "exists") setError(t(`savedViews.errors.${result.error}`));
      return;
    }
    persist(result.views);
    setNaming(false);
    setName("");
    setError("");
  };

  const canSave = hasActiveFilters(current, defaults);

  return (
    <div className="saved-views" role="group" aria-label={t("savedViews.title")}>
      <span className="saved-views__label">{t("savedViews.title")}</span>
      {views.map((view) => (
        <span key={view.name} className="saved-views__chip">
          <button type="button" className="saved-views__apply" onClick={() => onApply(view.filters)}>
            {view.name}
          </button>
          <button type="button" className="saved-views__remove" aria-label={t("savedViews.remove", { name: view.name })} onClick={async () => await confirmDialog(t("savedViews.confirmRemove", { name: view.name })) && persist(removeView(views, view.name))}>
            ×
          </button>
        </span>
      ))}
      {naming ? (
        <form className="saved-views__form" onSubmit={submit}>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t("savedViews.namePlaceholder")} aria-label={t("savedViews.nameLabel")} autoFocus />
          <button type="submit" className="btn btn-primary btn-sm">
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setNaming(false); setError(""); }}>
            {t("common.cancel")}
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setNaming(true)} disabled={!canSave} title={canSave ? undefined : t("savedViews.nothingToSave")}>
          {t("savedViews.save")}
        </button>
      )}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
