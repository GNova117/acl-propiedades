import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import "./Gallery.css";

const SWIPE_THRESHOLD = 40;

// Visor de pantalla completa: flechas/teclado para cambiar de foto, swipe en
// móvil, clic para acercar/alejar (zoom simple con transform, sin recortar
// ni pedir una imagen más pesada). Se monta con un portal a <body> — igual
// que el mapa en pantalla completa — para no quedar atrapado detrás de
// algún ancestro de la página que cree su propio stacking context.
function Lightbox({ images, index, onIndexChange, onClose, alt }) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndexChange((i) => (i + 1) % images.length);
      else if (e.key === "ArrowLeft") onIndexChange((i) => (i - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, onClose]);

  useEffect(() => setZoomed(false), [index]);

  const go = (delta) => onIndexChange((i) => (i + delta + images.length) % images.length);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) go(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return createPortal(
    <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="gallery-lightbox__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="gallery-lightbox__top">
        <span className="gallery-lightbox__counter">{t("gallery.counter", { current: index + 1, total: images.length })}</span>
        <button type="button" className="gallery-lightbox__close" onClick={onClose} aria-label={t("common.close")}>
          ×
        </button>
      </div>

      <div className="gallery-lightbox__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {images.length > 1 && (
          <button type="button" className="gallery-lightbox__nav gallery-lightbox__nav--prev" onClick={() => go(-1)} aria-label={t("gallery.prev")}>
            ‹
          </button>
        )}
        <img
          src={images[index]}
          alt={`${alt} - ${index + 1}`}
          className={`gallery-lightbox__image ${zoomed ? "gallery-lightbox__image--zoomed" : ""}`}
          onClick={() => setZoomed((z) => !z)}
        />
        {images.length > 1 && (
          <button type="button" className="gallery-lightbox__nav gallery-lightbox__nav--next" onClick={() => go(1)} aria-label={t("gallery.next")}>
            ›
          </button>
        )}
      </div>
      <p className="gallery-lightbox__hint">{t("gallery.zoomHint")}</p>

      {images.length > 1 && (
        <div className="gallery-lightbox__thumbs">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={`gallery__thumb ${i === index ? "gallery__thumb--active" : ""}`}
              onClick={() => onIndexChange(() => i)}
              aria-label={`Ver imagen ${i + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

export default function Gallery({ images, alt }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const list = images && images.length > 0 ? images : ["https://placehold.co/1000x700?text=ACL+Propiedades"];
  const { t } = useTranslation();

  // El index del lightbox puede recibir un número o una función updater
  // (igual que setState), para reusar la misma prop con teclado/swipe/clic.
  const setLightboxIndex = (next) => setActive((prev) => (typeof next === "function" ? next(prev) : next));

  return (
    <div className="gallery">
      <button type="button" className="gallery__main" onClick={() => setLightboxOpen(true)} aria-label={t("gallery.expand")}>
        <img src={list[active]} alt={`${alt} - imagen ${active + 1}`} />
        <span className="gallery__expand-badge">⤢ {t("gallery.expand")}</span>
      </button>
      {list.length > 1 && (
        <div className="gallery__thumbs">
          {list.map((src, index) => (
            <button
              key={src + index}
              type="button"
              className={`gallery__thumb ${index === active ? "gallery__thumb--active" : ""}`}
              onClick={() => setActive(index)}
              aria-label={`Ver imagen ${index + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <Lightbox images={list} index={active} onIndexChange={setLightboxIndex} onClose={() => setLightboxOpen(false)} alt={alt} />
      )}
    </div>
  );
}
