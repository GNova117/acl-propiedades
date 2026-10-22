import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./ImageUploader.css";

// Mismo patrón que VideoUploader (sin el concepto de "foto principal" de
// ImageUploader, que no aplica aquí): una cuadrícula simple para subir las
// fotos panorámicas 360° de una propiedad.
export default function Tour360Uploader({ existingImages, files, onRemoveExisting, onAddFiles, onRemoveNew }) {
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
          {combined.map((item) => (
            <div key={`${item.kind}-${item.index}`} className="image-uploader__item">
              <img src={item.src} alt="" />
              <button
                type="button"
                className="image-uploader__remove"
                onClick={() => (item.kind === "existing" ? onRemoveExisting(item.index) : onRemoveNew(item.index))}
                aria-label="Eliminar imagen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
