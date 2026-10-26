import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Reveal from "./Reveal";
import { formatMXN } from "../lib/format";
import { pickVideoTours, posterFrameUrl } from "../lib/videoTours";
import "./VideoTours.css";

function TourCard({ property, src, active, onPlay }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);

  // Solo suena un recorrido a la vez: al activarse otro, este se pausa.
  useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);

  const play = () => {
    setStarted(true);
    onPlay();
    videoRef.current?.play().catch(() => {});
  };

  return (
    <article className="video-tours__card">
      <video
        ref={videoRef}
        src={posterFrameUrl(src)}
        preload="metadata"
        playsInline
        controls={started}
        onEnded={() => setStarted(false)}
        aria-label={t("videoTours.videoLabel", { title: property.title })}
      />
      {!started && (
        <button type="button" className="video-tours__play" onClick={play} aria-label={t("videoTours.play", { title: property.title })}>
          <span aria-hidden="true">▶</span>
        </button>
      )}
      <Link to={`/propiedades/${property.id}`} className="video-tours__info">
        <strong>{property.title}</strong>
        <span>{formatMXN(property.price)} · {property.zone}</span>
      </Link>
    </article>
  );
}

// Tira de recorridos en video del inicio (formato vertical tipo Reel). No se
// pinta si ninguna propiedad disponible tiene video.
export default function VideoTours({ properties }) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(null);
  const tours = pickVideoTours(properties);
  if (tours.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-heading">
          <span className="section-heading__eyebrow">{t("videoTours.eyebrow")}</span>
          <h2>{t("videoTours.title")}</h2>
        </Reveal>
        <div className="video-tours__row">
          {tours.map(({ property, src }) => (
            <TourCard key={property.id} property={property} src={src} active={activeId === property.id} onPlay={() => setActiveId(property.id)} />
          ))}
        </div>
      </div>
    </section>
  );
}
