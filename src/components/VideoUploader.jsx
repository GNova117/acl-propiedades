import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./VideoUploader.css";

const MAX_VIDEO_MB = 100;

export default function VideoUploader({ existingVideos, files, onRemoveExisting, onAddFiles, onRemoveNew }) {
  const { t } = useTranslation();
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const combined = useMemo(
    () => [
      ...existingVideos.map((src, index) => ({ src, kind: "existing", index })),
      ...previews.map((src, index) => ({ src, kind: "new", index })),
    ],
    [existingVideos, previews]
  );

  const handleFileInput = (e) => {
    if (!e.target.files?.length) return;
    const picked = Array.from(e.target.files);
    const tooLarge = picked.filter((file) => file.size > MAX_VIDEO_MB * 1024 * 1024);
    const accepted = picked.filter((file) => file.size <= MAX_VIDEO_MB * 1024 * 1024);
    if (tooLarge.length > 0) {
      window.alert(t("admin.videoTooLarge", { max: MAX_VIDEO_MB, names: tooLarge.map((f) => f.name).join(", ") }));
    }
    if (accepted.length > 0) onAddFiles(accepted);
    e.target.value = "";
  };

  return (
    <div className="video-uploader">
      <label className="video-uploader__dropzone">
        <input type="file" accept="video/*" multiple onChange={handleFileInput} />
        <span>{t("admin.uploadVideos")}</span>
      </label>
      <p className="form-hint">{t("admin.videoHint", { max: MAX_VIDEO_MB })}</p>

      {combined.length > 0 && (
        <div className="video-uploader__grid">
          {combined.map((item) => (
            <div key={`${item.kind}-${item.index}`} className="video-uploader__item">
              <video src={item.src} controls preload="metadata" />
              <button
                type="button"
                className="video-uploader__remove"
                onClick={() => (item.kind === "existing" ? onRemoveExisting(item.index) : onRemoveNew(item.index))}
                aria-label="Eliminar video"
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
