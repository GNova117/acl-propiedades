import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { INSPECTION_CATEGORIES } from "../lib/propertyInspection";
import "./InspectionChecklist.css";

const rowKey = (category, key) => `${category}.${key}`;

// Checklist interactivo del cotejo: Sí/No (N/A solo donde aplica) + una foto
// opcional por criterio. La miniatura de una foto recién tomada se genera con
// URL.createObjectURL — se guarda en estado (no se recrea en cada render) y
// se revoca al reemplazar/quitar/desmontar, igual que DocumentCapture.jsx.
export default function InspectionChecklist({ checklist, onChange, showIncomplete = false }) {
  const { t } = useTranslation();
  const [previewUrls, setPreviewUrls] = useState({});
  const previewUrlsRef = useRef(previewUrls);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(
    () => () => {
      Object.values(previewUrlsRef.current).forEach((url) => url && URL.revokeObjectURL(url));
    },
    []
  );

  const rowFor = (category, key) => checklist.find((e) => e.category === category && e.key === key) || { category, key, estado: "", file_path: null };

  const setEstado = (category, key, estado) => {
    onChange(checklist.map((e) => (e.category === category && e.key === key ? { ...e, estado } : e)));
  };

  const setFile = (category, key, file) => {
    const rk = rowKey(category, key);
    setPreviewUrls((prev) => {
      if (prev[rk]) URL.revokeObjectURL(prev[rk]);
      return { ...prev, [rk]: URL.createObjectURL(file) };
    });
    onChange(checklist.map((e) => (e.category === category && e.key === key ? { ...e, file, removed: false } : e)));
  };

  const removePhoto = (category, key) => {
    const rk = rowKey(category, key);
    setPreviewUrls((prev) => {
      if (!prev[rk]) return prev;
      URL.revokeObjectURL(prev[rk]);
      const next = { ...prev };
      delete next[rk];
      return next;
    });
    onChange(checklist.map((e) => (e.category === category && e.key === key ? { ...e, file: null, removed: true } : e)));
  };

  return (
    <div className="inspection-checklist">
      {INSPECTION_CATEGORIES.map((cat) => (
        <fieldset key={cat.key} className="inspection-checklist__category">
          <legend>{t(`inspections.categories.${cat.key}`)}</legend>
          {cat.items.map((item) => {
            const row = rowFor(cat.key, item.key);
            const rk = rowKey(cat.key, item.key);
            const photoUrl = row.removed ? null : previewUrls[rk] || row.signed_url || row.file_path;
            const unanswered = showIncomplete && !row.estado;
            return (
              <div key={item.key} className={`inspection-checklist__row${unanswered ? " is-unanswered" : ""}`}>
                <div className="inspection-checklist__criterio">{t(`inspections.checklist.${cat.key}.${item.key}`)}</div>
                <div className="inspection-checklist__pills" role="radiogroup" aria-label={t(`inspections.checklist.${cat.key}.${item.key}`)}>
                  {["si", "no"].map((estado) => (
                    <label key={estado} className={`ic-pill ic-pill--${estado}${row.estado === estado ? " is-active" : ""}`}>
                      <input type="radio" name={rk} checked={row.estado === estado} onChange={() => setEstado(cat.key, item.key, estado)} />
                      {t(`inspections.estado.${estado}`)}
                    </label>
                  ))}
                  {item.allowNA && (
                    <label className={`ic-pill ic-pill--na${row.estado === "na" ? " is-active" : ""}`}>
                      <input type="radio" name={rk} checked={row.estado === "na"} onChange={() => setEstado(cat.key, item.key, "na")} />
                      {t("inspections.estado.na")}
                    </label>
                  )}
                </div>
                <div className="inspection-checklist__photo">
                  {photoUrl ? (
                    <div className="ic-photo">
                      <img src={photoUrl} alt="" />
                      <button type="button" className="ic-photo__remove" onClick={() => removePhoto(cat.key, item.key)} aria-label={t("inspections.checklist.removePhoto")}>
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="btn btn-outline btn-sm ic-photo__add">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) setFile(cat.key, item.key, file);
                        }}
                      />
                      {t("inspections.checklist.addPhoto")}
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
