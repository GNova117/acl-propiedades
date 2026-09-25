import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildCaption, canvasToBlob, downloadBlob, postFileName, propertyUrl, renderPostCanvas } from "../lib/socialPost";
import "./SocialPostModal.css";

// "Publicar en redes": arma el texto y una imagen vertical con los datos, y da
// las salidas más útiles (copiar, descargar, compartir del celular, Facebook,
// WhatsApp). No publica por sí mismo; Instagram/Facebook no lo permiten desde
// una página web sin integrar su API.
export default function SocialPostModal({ property, onClose }) {
  const { t } = useTranslation();
  const origin = window.location.origin;
  const photos = useMemo(() => {
    const list = [property.main_image, ...(property.images || [])].filter(Boolean);
    return Array.from(new Set(list));
  }, [property]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [caption, setCaption] = useState(() => buildCaption(property, { origin }));
  const [preview, setPreview] = useState("");
  const [blob, setBlob] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [imageError, setImageError] = useState("");
  const [notice, setNotice] = useState("");
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Cada vez que se elige otra foto se vuelve a dibujar la imagen.
  useEffect(() => {
    if (!photos[photoIndex]) {
      setImageError(t("socialPost.noPhotos"));
      return undefined;
    }
    let cancelled = false;
    let objectUrl = "";
    setRendering(true);
    setImageError("");
    renderPostCanvas(property, photos[photoIndex])
      .then((canvas) => canvasToBlob(canvas))
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setPreview(objectUrl);
      })
      .catch(() => !cancelled && setImageError(t("socialPost.imageError")))
      .finally(() => !cancelled && setRendering(false));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoIndex, property]);

  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 2500);
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      const area = document.getElementById("social-caption");
      area?.select();
      document.execCommand("copy");
    }
    flash(t("socialPost.copied"));
  };

  const canShareFiles = () => {
    if (!blob || !navigator.canShare || !navigator.share) return false;
    return navigator.canShare({ files: [new File([blob], `${postFileName(property)}.jpg`, { type: "image/jpeg" })] });
  };

  const share = async () => {
    try {
      await navigator.share({ text: caption, files: [new File([blob], `${postFileName(property)}.jpg`, { type: "image/jpeg" })] });
    } catch (err) {
      if (err?.name !== "AbortError") flash(t("socialPost.shareError"));
    }
  };

  const downloadAllPhotos = async () => {
    setZipping(true);
    try {
      const { zipSync } = await import("fflate");
      const files = {};
      for (let i = 0; i < photos.length; i++) {
        const res = await fetch(photos[i]);
        if (!res.ok) continue;
        const ext = (res.headers.get("content-type") || "image/jpeg").includes("png") ? "png" : "jpg";
        files[`${postFileName(property)}_${String(i + 1).padStart(2, "0")}.${ext}`] = new Uint8Array(await res.arrayBuffer());
      }
      downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }), `${postFileName(property, "_fotos")}.zip`);
    } catch {
      flash(t("socialPost.imageError"));
    } finally {
      setZipping(false);
    }
  };

  const url = propertyUrl(property, origin);

  return (
    <div className="social-modal" role="dialog" aria-modal="true" aria-label={t("socialPost.title")}>
      <div className="social-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="social-modal__box card">
        <div className="social-modal__head">
          <h2 style={{ margin: 0 }}>{t("socialPost.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        <div className="social-modal__grid">
          <div>
            <div className="social-modal__preview">
              {rendering && <span className="spinner" />}
              {preview && !imageError && <img src={preview} alt={t("socialPost.previewAlt")} style={{ opacity: rendering ? 0.4 : 1 }} />}
              {imageError && <p className="form-error">{imageError}</p>}
            </div>
            {photos.length > 1 && (
              <div className="social-modal__thumbs" role="listbox" aria-label={t("socialPost.choosePhoto")}>
                {photos.map((src, i) => (
                  <button
                    type="button"
                    key={src}
                    role="option"
                    aria-selected={i === photoIndex}
                    className={i === photoIndex ? "is-active" : ""}
                    onClick={() => setPhotoIndex(i)}
                  >
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="social-modal__side">
            <label htmlFor="social-caption" style={{ fontWeight: 600 }}>
              {t("socialPost.caption")}
            </label>
            <textarea id="social-caption" rows={12} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <div className="social-modal__buttons">
              <button type="button" className="btn btn-primary btn-sm" onClick={copyCaption}>
                {t("socialPost.copy")}
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={!blob} onClick={() => downloadBlob(blob, `${postFileName(property)}.jpg`)}>
                {t("socialPost.downloadImage")}
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={zipping || photos.length === 0} onClick={downloadAllPhotos}>
                {zipping ? <span className="spinner" /> : null}
                {t("socialPost.downloadPhotos", { count: photos.length })}
              </button>
              {canShareFiles() && (
                <button type="button" className="btn btn-outline btn-sm" onClick={share}>
                  {t("socialPost.share")}
                </button>
              )}
              <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>
                Facebook
              </a>
              <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(caption)}`}>
                WhatsApp
              </a>
            </div>
            {notice && <p className="form-hint" style={{ color: "var(--color-success)" }}>{notice}</p>}
            <p className="form-hint">{t("socialPost.instagramNote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
