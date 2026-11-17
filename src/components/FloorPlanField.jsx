import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FLOOR_PLAN_MAX_BYTES, floorPlanFileError } from "../lib/floorPlan";
import "./ImageUploader.css";
import "./FloorPlanField.css";

// Campo del formulario de la propiedad para el plano que se ve en la ficha
// pública: una sola imagen (PNG o JPG), con vista previa y para quitarla. No
// guarda nada por sí mismo: avisa a la pantalla con onPick/onRemove y es ella
// quien lo sube al guardar la propiedad.
export default function FloorPlanField({ existingUrl, file, removed, onPick, onRemove }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview || (removed ? null : existingUrl);

  const handleInput = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const problem = floorPlanFileError(picked);
    if (problem) {
      setError(t(problem, { mb: FLOOR_PLAN_MAX_BYTES / 1024 / 1024 }));
      return;
    }
    setError("");
    onPick(picked);
  };

  return (
    <div className="floor-plan-field">
      {shown ? (
        <div className="floor-plan-field__preview">
          <img src={shown} alt={t("floorPlan.previewAlt")} />
          <button type="button" className="btn btn-outline btn-sm" onClick={onRemove}>
            {t("floorPlan.remove")}
          </button>
        </div>
      ) : null}
      <label className="image-uploader__dropzone">
        <input type="file" accept="image/png,image/jpeg" onChange={handleInput} data-testid="floor-plan-input" />
        <span>{shown ? t("floorPlan.replace") : t("floorPlan.upload")}</span>
      </label>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
