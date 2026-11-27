import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./ImageUploader.css";

// `showMain={false}`: galerías donde no hay una foto "principal" (p. ej. las fotos
// de un modelo de departamento), así que no se ofrece el botón de elegirla.
export default function ImageUploader({ existingImages, files, mainIndex, onRemoveExisting, onAddFiles, onRemoveNew, onSetMain, onMoveExisting, onMoveNew, showMain = true }) {
  const { t } = useTranslation();
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const combined = useMemo(
    () => [
      ...existingImages.map((src, index) => ({ src, kind: "existing", index })),
      ...previews.map((src, index) => ({ src, kind: "new", index })),
    ],
    [existingImages, previews]
  );

  const handleFileInput = (e) => {
    if (e.target.files?.length) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  return (
    <div className="image-uploader">
      <label className="image-uploader__dropzone">
        <input type="file" accept="image/*" multiple onChange={handleFileInput} />
        <span>{t("admin.uploadImages")}</span>
      </label>

      {combined.length > 0 && (
        <div className="image-uploader__grid">
          {combined.map((item, flatIndex) => (
            <div key={`${item.kind}-${item.index}`} className={`image-uploader__item ${flatIndex === mainIndex ? "image-uploader__item--main" : ""}`}>
              <img src={item.src} alt="" />
              <button
                type="button"
                className="image-uploader__remove"
                onClick={() => (item.kind === "existing" ? onRemoveExisting(item.index) : onRemoveNew(item.index))}
                aria-label={t("a11y.removeImage")}
              >
                ×
              </button>
              {(item.kind === "existing" ? onMoveExisting : onMoveNew) && (
                <div className="image-uploader__order">
                  <button type="button" onClick={() => (item.kind === "existing" ? onMoveExisting : onMoveNew)(item.index, -1)} aria-label={t("admin.moveImageLeft")} disabled={item.index === 0}>
                    ◀
                  </button>
                  <button type="button" onClick={() => (item.kind === "existing" ? onMoveExisting : onMoveNew)(item.index, 1)} aria-label={t("admin.moveImageRight")} disabled={item.index === (item.kind === "existing" ? existingImages.length : files.length) - 1}>
                    ▶
                  </button>
                </div>
              )}
              {showMain &&
                (flatIndex === mainIndex ? (
                  <span className="image-uploader__main-badge">★ {t("admin.mainImage")}</span>
                ) : (
                  <button type="button" className="image-uploader__main-btn" onClick={() => onSetMain(flatIndex)}>
                    {t("admin.setMain")}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
