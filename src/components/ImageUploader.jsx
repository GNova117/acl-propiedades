import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./ImageUploader.css";

export default function ImageUploader({ existingImages, files, mainIndex, onRemoveExisting, onAddFiles, onRemoveNew, onSetMain }) {
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
                aria-label="Eliminar imagen"
              >
                ×
              </button>
              {flatIndex === mainIndex ? (
                <span className="image-uploader__main-badge">★ {t("admin.mainImage")}</span>
              ) : (
                <button type="button" className="image-uploader__main-btn" onClick={() => onSetMain(flatIndex)}>
                  {t("admin.setMain")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
