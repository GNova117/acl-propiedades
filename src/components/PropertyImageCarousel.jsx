import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./PropertyImageCarousel.css";

// Fotos deslizables dentro de la tarjeta del listado: con el dedo (el navegador
// engancha cada foto al deslizar) y con flechas en computadora. Solo se baja la
// primera foto hasta que alguien toca, pasa el cursor o enfoca la tarjeta: con 24
// tarjetas por página, bajar 6 fotos de cada una de golpe sería demasiado.
export default function PropertyImageCarousel({ images, alt }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [activated, setActivated] = useState(false);

  if (images.length === 0) return null;
  if (images.length === 1) return <img src={images[0]} alt={alt} loading="lazy" decoding="async" />;

  const visible = activated ? images : images.slice(0, 1);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const go = (event, delta) => {
    // La tarjeta entera es un enlace a la ficha: las flechas no deben abrirla.
    event.preventDefault();
    event.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    setActivated(true);
    const next = Math.min(Math.max(index + delta, 0), images.length - 1);
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      className="card-carousel"
      onPointerEnter={() => setActivated(true)}
      onTouchStart={() => setActivated(true)}
      onFocus={() => setActivated(true)}
    >
      <div className="card-carousel__track" ref={trackRef} onScroll={onScroll}>
        {visible.map((src, i) => (
          <img
            key={src}
            className="card-carousel__slide"
            src={src}
            alt={i === 0 ? alt : ""}
            loading={i === 0 ? "lazy" : undefined}
            decoding="async"
            draggable="false"
          />
        ))}
      </div>
      {index > 0 && (
        <button type="button" className="card-carousel__nav card-carousel__nav--prev" onClick={(e) => go(e, -1)} aria-label={t("gallery.prev")}>
          ‹
        </button>
      )}
      {index < images.length - 1 && (
        <button type="button" className="card-carousel__nav card-carousel__nav--next" onClick={(e) => go(e, 1)} aria-label={t("gallery.next")}>
          ›
        </button>
      )}
      <span className="card-carousel__dots" aria-hidden="true">
        {images.map((src, i) => (
          <span key={src} className={i === index ? "is-active" : ""} />
        ))}
      </span>
    </div>
  );
}
