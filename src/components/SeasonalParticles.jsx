import { useEffect, useState } from "react";
import SeasonalShape from "./SeasonalShape";
import { getActiveSeason } from "../lib/seasons";
import "./SeasonalParticles.css";

// Lluvia breve de la temporada activa (confeti, pétalos, murciélagos...):
// una sola pasada al cargar el sitio, no se repite al navegar entre
// páginas porque vive en App y no en PublicLayout (que se vuelve a montar
// en cada ruta). Nunca bloquea clics (pointer-events: none) y no aparece
// si el visitante pidió reducir animaciones.

// Arranca cuando ya se fue la pantalla de carga de main.jsx (1.5 s).
const START_DELAY = 1.4;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const SIZES = {
  confeti: [9, 15],
  flor: [14, 24],
  corazon: [14, 24],
  nieve: [12, 22],
  murcielago: [26, 40],
};

function buildParticles(season) {
  const { shape, motion, colors } = season.particles;
  const narrow = window.innerWidth < 640;
  const count = motion === "fly" ? (narrow ? 4 : 7) : narrow ? 12 : 22;
  const [minSize, maxSize] = SIZES[shape] || [12, 22];

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    shape,
    motion,
    color: colors.length ? pick(colors) : "currentColor",
    size: Math.round(rand(minSize, maxSize)),
    x: rand(0, 96),
    y: rand(8, 60),
    delay: START_DELAY + rand(0, motion === "fly" ? 7 : 6),
    duration: motion === "fly" ? rand(7, 11) : rand(8, 14),
    sway: Math.round(rand(20, 60)),
    spin: rand(2.5, 6),
    reverse: motion === "fly" && Math.random() < 0.4,
  }));
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function SeasonalParticles() {
  const [particles] = useState(() => {
    const season = getActiveSeason();
    return season?.particles && !prefersReducedMotion() ? buildParticles(season) : [];
  });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!particles.length) return;
    const total = Math.max(...particles.map((p) => p.delay + p.duration));
    const timer = setTimeout(() => setDone(true), (total + 0.5) * 1000);
    return () => clearTimeout(timer);
  }, [particles]);

  if (done || !particles.length) return null;

  return (
    <div className="seasonal-particles" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className={`seasonal-particle seasonal-particle--${p.motion} seasonal-particle--${p.shape}${p.reverse ? " seasonal-particle--reverse" : ""}`}
          style={{
            "--x": `${p.x}%`,
            "--y": `${p.y}%`,
            "--delay": `${p.delay}s`,
            "--duration": `${p.duration}s`,
            "--sway": `${p.sway}px`,
            "--spin": `${p.spin}s`,
          }}
        >
          <span className="seasonal-particle__drift">
            <SeasonalShape name={p.shape} color={p.color} size={p.size} className="seasonal-particle__shape" />
          </span>
        </span>
      ))}
    </div>
  );
}
