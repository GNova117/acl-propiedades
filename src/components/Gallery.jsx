import ResponsiveImg from "./ResponsiveImg";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { swipeDirection } from "../lib/swipe";
import { useMediaQuery } from "../lib/useMediaQuery";
import "./Gallery.css";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
// Tras un toque, el navegador manda además un clic "fantasma": se ignora para
// que no desacerque lo que el doble toque acaba de acercar.
const GHOST_CLICK_MS = 500;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

// Visor de pantalla completa: flechas/teclado para cambiar de foto; en el
// teléfono, deslizar para cambiar, pellizcar para acercar, arrastrar para mover
// la foto acercada y doble toque para acercar o volver; en computadora, clic
// para acercar y mover el cursor para recorrer la foto. Se monta con un portal
// a <body> — igual que el mapa en pantalla completa — para no quedar atrapado
// detrás de algún ancestro de la página que cree su propio stacking context.
export function Lightbox({ images, index, onIndexChange, onClose, alt }) {
  const { t } = useTranslation();
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);
  const gesture = useRef(null);
  const lastTap = useRef(0);
  const lastTouch = useRef(0);
  const imgRef = useRef(null);
  const zoomed = view.scale > 1;

  // Precarga la foto siguiente y la anterior: cada deslizamiento esperaba la descarga.
  useEffect(() => {
    for (const offset of [1, -1]) {
      const src = images[index + offset];
      if (src) new Image().src = src;
    }
  }, [images, index]);

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

  useEffect(() => setView({ scale: 1, x: 0, y: 0 }), [index]);

  const go = (delta) => onIndexChange((i) => (i + delta + images.length) % images.length);

  // Cuánto puede moverse la foto acercada sin dejar ver el vacío de los lados.
  const limits = (scale) => {
    const img = imgRef.current;
    const w = img ? img.clientWidth : 0;
    const h = img ? img.clientHeight : 0;
    return { x: ((scale - 1) * w) / 2, y: ((scale - 1) * h) / 2 };
  };

  const toggleZoom = () => setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: DOUBLE_TAP_SCALE, x: 0, y: 0 }));

  const onTouchStart = (e) => {
    lastTouch.current = Date.now();
    // Un toque de un dedo en una flecha es de la flecha, no un gesto sobre la foto;
    // con dos dedos siempre es un pellizco, caigan donde caigan.
    if (e.touches.length === 1 && e.target.closest?.("button")) {
      gesture.current = null;
      return;
    }
    if (e.touches.length === 2) {
      gesture.current = { mode: "pinch", dist0: distance(e.touches[0], e.touches[1]), scale0: view.scale, x0: view.x, y0: view.y };
      setGesturing(true);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      gesture.current = { mode: zoomed ? "pan" : "swipe", startX: touch.clientX, startY: touch.clientY, x0: view.x, y0: view.y, moved: false };
      setGesturing(zoomed);
    }
  };

  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    if (g.mode === "pinch" && e.touches.length === 2) {
      const scale = clamp((g.scale0 * distance(e.touches[0], e.touches[1])) / g.dist0, 1, MAX_SCALE);
      const max = limits(scale);
      setView({ scale, x: clamp(g.x0, -max.x, max.x), y: clamp(g.y0, -max.y, max.y) });
    } else if (g.mode === "pan" && e.touches.length === 1) {
      const touch = e.touches[0];
      const max = limits(view.scale);
      g.moved = true;
      setView((v) => ({ ...v, x: clamp(g.x0 + touch.clientX - g.startX, -max.x, max.x), y: clamp(g.y0 + touch.clientY - g.startY, -max.y, max.y) }));
    } else if (g.mode === "swipe" && e.touches.length === 1) {
      const touch = e.touches[0];
      if (Math.hypot(touch.clientX - g.startX, touch.clientY - g.startY) > 10) g.moved = true;
    }
  };

  const onTouchEnd = (e) => {
    lastTouch.current = Date.now();
    const g = gesture.current;
    if (!g) return;
    if (e.touches.length > 0) {
      // Quedó un dedo tras un pellizco: sigue como arrastre desde donde está.
      if (g.mode === "pinch") {
        const touch = e.touches[0];
        gesture.current = { mode: "pan", startX: touch.clientX, startY: touch.clientY, x0: view.x, y0: view.y, moved: true };
      }
      return;
    }
    gesture.current = null;
    setGesturing(false);
    if (g.mode === "pinch") {
      setView((v) => (v.scale < 1.05 ? { scale: 1, x: 0, y: 0 } : v));
      return;
    }
    const touch = e.changedTouches[0];
    if (g.mode === "swipe" && touch) {
      // Deslizar hacia abajo cierra el visor (el gesto que se espera en el teléfono).
      const dy = touch.clientY - g.startY;
      const dx = touch.clientX - g.startX;
      if (dy > 90 && dy > Math.abs(dx) * 1.5) {
        onClose();
        return;
      }
      const direction = swipeDirection(g.startX, g.startY, touch.clientX, touch.clientY);
      if (direction) {
        go(direction);
        return;
      }
    }
    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        toggleZoom();
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  const onImageClick = () => {
    if (Date.now() - lastTouch.current < GHOST_CLICK_MS) return;
    toggleZoom();
  };

  // Con el ratón y la foto acercada, el cursor recorre la foto.
  const onMouseMove = (e) => {
    if (!zoomed || Date.now() - lastTouch.current < GHOST_CLICK_MS) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const max = limits(view.scale);
    const relX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    setView((v) => ({ ...v, x: (0.5 - relX) * 2 * max.x, y: (0.5 - relY) * 2 * max.y }));
  };

  return createPortal(
    <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="gallery-lightbox__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="gallery-lightbox__top">
        <span className="gallery-lightbox__counter">{t("gallery.counter", { current: index + 1, total: images.length })}</span>
        <a className="gallery-lightbox__download" href={images[index]} target="_blank" rel="noopener noreferrer" download aria-label={t("gallery.download")}>
          ⬇
        </a>
        <button type="button" className="gallery-lightbox__close" onClick={onClose} aria-label={t("common.close")}>
          ×
        </button>
      </div>

      <div
        className="gallery-lightbox__stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseMove={onMouseMove}
      >
        {images.length > 1 && !zoomed && (
          <button type="button" className="gallery-lightbox__nav gallery-lightbox__nav--prev" onClick={() => go(-1)} aria-label={t("gallery.prev")}>
            ‹
          </button>
        )}
        <img
          ref={imgRef}
          src={images[index]}
          alt={`${alt} - ${index + 1}`}
          className={`gallery-lightbox__image ${zoomed ? "gallery-lightbox__image--zoomed" : ""} ${gesturing ? "is-gesturing" : ""}`}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          draggable="false"
          onClick={onImageClick}
        />
        {images.length > 1 && !zoomed && (
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
              aria-label={t("gallery.viewImage", { number: i + 1 })}
            >
              <ResponsiveImg src={src} sizes="96px" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// Foto de reemplazo propia (sin texto, sin servicio externo): antes venía de placehold.co, en inglés y con un tercero.
export const NO_PHOTO = "/sin-foto.svg";

export default function Gallery({ images, alt }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const list = images && images.length > 0 ? images : [NO_PHOTO];
  const { t } = useTranslation();
  // En computadora y con 3 fotos o más, la galería es un MOSAICO (una grande y hasta cuatro chicas); en el teléfono y con
  // pocas fotos sigue siendo la foto principal con su tira de miniaturas (que se desliza con el dedo).
  const wide = useMediaQuery("(min-width: 981px)");
  const mosaic = wide && list.length >= 3;
  const tiles = mosaic ? list.slice(1, 5) : [];
  const hidden = list.length - 1 - tiles.length;

  // El index del lightbox puede recibir un número o una función updater
  // (igual que setState), para reusar la misma prop con teclado/swipe/clic.
  const setLightboxIndex = (next) => setActive((prev) => (typeof next === "function" ? next(prev) : next));

  // Deslizar la foto principal con el dedo. Un deslizamiento no debe abrir el
  // visor: se anota para ignorar el clic que algunos navegadores mandan después.
  const touchStart = useRef(null);
  const swipedAt = useRef(0);
  const onMainTouchStart = (e) => {
    const touch = e.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onMainTouchEnd = (e) => {
    const start = touchStart.current;
    const touch = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch || list.length < 2) return;
    const direction = swipeDirection(start.x, start.y, touch.clientX, touch.clientY);
    if (!direction) return;
    swipedAt.current = Date.now();
    setActive((i) => (i + direction + list.length) % list.length);
  };
  const onMainClick = () => {
    if (Date.now() - swipedAt.current < 400) return;
    setLightboxOpen(true);
  };

  return (
    <div className={`gallery${mosaic ? " gallery--mosaic" : ""}`}>
      <button
        type="button"
        className="gallery__main"
        onClick={onMainClick}
        onTouchStart={onMainTouchStart}
        onTouchEnd={onMainTouchEnd}
        aria-label={list.length > 1 ? `${t("gallery.counter", { current: active + 1, total: list.length })} · ${t("gallery.expand")}` : t("gallery.expand")}
      >
        {/* Es la imagen principal de la ficha de propiedad — normalmente el
            LCP de la página — así que se carga eager, no lazy. */}
        <ResponsiveImg src={list[active]} sizes="(min-width: 980px) 640px, 100vw" alt={t("gallery.imageAlt", { alt, number: active + 1 })} decoding="async" fetchPriority="high" />
        {list.length > 1 && <span className="gallery__counter">{t("gallery.counter", { current: active + 1, total: list.length })}</span>}
        <span className="gallery__expand-badge">⤢ {t("gallery.expand")}</span>
      </button>
      {mosaic && (
        <div className={`gallery__side gallery__side--${tiles.length}`}>
          {tiles.map((src, i) => {
            const index = i + 1;
            const last = i === tiles.length - 1 && hidden > 0;
            return (
              <button
                key={src + index}
                type="button"
                className="gallery__tile"
                onClick={() => {
                  setActive(index);
                  setLightboxOpen(true);
                }}
                aria-label={last ? t("gallery.seeAll", { count: list.length }) : t("gallery.viewImage", { number: index + 1 })}
              >
                <ResponsiveImg src={src} sizes="200px" alt="" loading="lazy" decoding="async" />
                {last && <span className="gallery__more">{t("gallery.moreCount", { count: hidden })}</span>}
              </button>
            );
          })}
        </div>
      )}
      {!mosaic && list.length > 1 && (
        <div className="gallery__thumbs">
          {list.map((src, index) => (
            <button
              key={src + index}
              type="button"
              className={`gallery__thumb ${index === active ? "gallery__thumb--active" : ""}`}
              onClick={() => setActive(index)}
              aria-label={t("gallery.viewImage", { number: index + 1 })}
            >
              <ResponsiveImg src={src} sizes="96px" alt="" loading="lazy" decoding="async" />
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
