import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { computeSpaceMetrics, suggestedQuantity } from "../lib/materialConsumption";
import { formatArea } from "../lib/format";
import SpaceRender from "./SpaceRender";
import "./SpacesEditor.css";

function uid() {
  return `space-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function matUid() {
  return `mat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_SPACE = { name: "", length: "", width: "", height: "" };

export default function SpacesEditor({ spaces, onChange, onAddMaterial }) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    db.getMaterialsCatalog({ activeOnly: true }).then(setCatalog);
  }, []);

  const updateSpace = (id, field, value) => {
    onChange((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };
  const addSpace = () => onChange((prev) => [...prev, { id: uid(), ...EMPTY_SPACE }]);
  const removeSpace = (id) => onChange((prev) => prev.filter((s) => s.id !== id));

  const suggestibleMaterials = catalog.filter((m) => m.consumption_rate != null && m.consumption_basis);

  return (
    <div className="spaces-editor">
      {spaces.length === 0 && <p className="form-hint">{t("spaces.noSpaces")}</p>}

      {spaces.map((space) => {
        const metrics = computeSpaceMetrics(space);
        const hasDims = Number(space.length) > 0 && Number(space.width) > 0 && Number(space.height) > 0;

        return (
          <div className="card spaces-editor__space" key={space.id}>
            <div className="spaces-editor__space-header">
              <input
                className="spaces-editor__name-input"
                placeholder={t("spaces.namePlaceholder")}
                value={space.name}
                onChange={(e) => updateSpace(space.id, "name", e.target.value)}
              />
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeSpace(space.id)}>
                {t("common.delete")}
              </button>
            </div>

            <div className="form-row spaces-editor__dims">
              <div className="form-field">
                <label>{t("spaces.length")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={space.length}
                  onChange={(e) => updateSpace(space.id, "length", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>{t("spaces.width")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={space.width}
                  onChange={(e) => updateSpace(space.id, "width", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>{t("spaces.height")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={space.height}
                  onChange={(e) => updateSpace(space.id, "height", e.target.value)}
                />
              </div>
            </div>

            {hasDims && (
              <div className="spaces-editor__preview">
                <SpaceRender length={space.length} width={space.width} height={space.height} />
                <div className="spaces-editor__metrics">
                  <span>
                    {t("spaces.floorArea")}: <strong>{formatArea(metrics.floorArea)}</strong>
                  </span>
                  <span>
                    {t("spaces.wallArea")}: <strong>{formatArea(metrics.wallArea)}</strong>
                  </span>
                  <span>
                    {t("spaces.volume")}: <strong>{metrics.volume.toFixed(2)} m³</strong>
                  </span>
                </div>
              </div>
            )}

            {hasDims && (
              <div className="spaces-editor__suggestions">
                <h4>{t("spaces.suggestedMaterials")}</h4>
                {suggestibleMaterials.length === 0 ? (
                  <p className="form-hint">{t("spaces.noStandardsYet")}</p>
                ) : (
                  <ul className="spaces-editor__suggestion-list">
                    {suggestibleMaterials.map((material) => {
                      const qty = suggestedQuantity(material, metrics);
                      if (qty == null) return null;
                      return (
                        <li key={material.id}>
                          <span>
                            {material.name}: <strong>{qty} {material.unit}</strong>
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              onAddMaterial({
                                id: matUid(),
                                material_id: material.id,
                                name: material.name,
                                category: material.category,
                                unit: material.unit,
                                quantity: qty,
                                unit_price_internal: material.unit_price_internal ?? "",
                                unit_price_external: material.unit_price_external ?? "",
                              })
                            }
                          >
                            {t("spaces.addToProject")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" className="btn btn-outline btn-sm" onClick={addSpace}>
        {t("spaces.addSpace")}
      </button>
    </div>
  );
}
