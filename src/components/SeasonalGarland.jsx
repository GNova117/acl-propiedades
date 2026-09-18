import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SeasonalShape, { ShapeGraphic } from "./SeasonalShape";
import { getActiveSeason, greetingYear } from "../lib/seasons";
import "./SeasonalGarland.css";

// Ancho de cada pieza + su separación (ver SeasonalGarland.css), para
// dibujar solo las que caben a lo ancho de la pantalla.
const ITEM_WIDTH = { "papel-picado": 50, banderines: 38, luces: 46 };

// --- Papel picado: un rectángulo con fleco en zigzag abajo y los recortes
// como subtrazos con fill-rule="evenodd" — lo que queda dentro de un
// recorte se ve hueco, y lo que va dentro de un hueco (ojos de la
// calavera) vuelve a ser papel.
const PP_W = 44;
const PP_TEETH = 6;

const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const diamond = (cx, cy, d) => `M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z`;
const around = (count, radius, offsetDeg, fn) =>
  Array.from({ length: count }, (_, i) => {
    const a = ((i / count) * 360 + offsetDeg) * (Math.PI / 180);
    return fn(22 + radius * Math.cos(a), 26 + radius * Math.sin(a));
  }).join("");

const PP_OUTLINE = (() => {
  const step = PP_W / PP_TEETH;
  let d = `M0 0H${PP_W}V48`;
  for (let i = PP_TEETH; i > 0; i--) {
    d += `L${(i * step - step / 2).toFixed(2)} 54L${((i - 1) * step).toFixed(2)} 48`;
  }
  return `${d}Z`;
})();

const PP_BORDER = [5.5, 11, 16.5, 22, 27.5, 33, 38.5].map((x) => circle(x, 9.5, 1.3) + circle(x, 43, 1.3)).join("");

const PP_MOTIFS = {
  flor: circle(22, 26, 4.2) + around(6, 10, 30, (x, y) => circle(x, y, 2.8)) + around(6, 14, 0, (x, y) => circle(x, y, 1.1)),
  rombos:
    [13, 22, 31].flatMap((x) => [17, 26, 35].map((y) => diamond(x, y, 3.4))).join("") +
    [
      [17.5, 21.5],
      [26.5, 21.5],
      [17.5, 30.5],
      [26.5, 30.5],
    ]
      .map(([x, y]) => circle(x, y, 1.3))
      .join(""),
  calavera:
    "M12 24A10 10 0 0 1 32 24L30 30.5L27.5 31.5V37H16.5V31.5L14 30.5Z" +
    circle(18, 25, 3) +
    circle(26, 25, 3) +
    "M22 28.5L23.4 31.2H20.6Z" +
    "M19.6 32.5H20.6V36.9H19.6ZM23.4 32.5H24.4V36.9H23.4Z",
};

function PapelPicado({ color, motif }) {
  return (
    <svg className="seasonal-garland__item" width="44" height="56" viewBox="0 0 44 56" style={{ "--item-color": color }}>
      <path d={PP_OUTLINE + PP_BORDER + (PP_MOTIFS[motif] || "")} fill={color} fillRule="evenodd" className="seasonal-garland__paper" />
      <rect width="44" height="5" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function Banderin({ color, motif, motifColor }) {
  return (
    <svg className="seasonal-garland__item" width="34" height="42" viewBox="0 0 34 42" style={{ "--item-color": color }}>
      <path d="M0 0H34L17 42Z" fill={color} className="seasonal-garland__paper" />
      <path d="M0 0H34L32.4 4H1.6Z" fill="rgba(0,0,0,0.14)" />
      {motif && (
        <svg x="11" y="8" width="12" height="12" viewBox="0 0 24 24">
          <ShapeGraphic name={motif} color={motifColor} />
        </svg>
      )}
    </svg>
  );
}

function Colgante({ name }) {
  return (
    <svg className="seasonal-garland__item seasonal-garland__item--pendant" width="34" height="42" viewBox="0 0 34 42">
      <line x1="17" y1="0" x2="17" y2="12" className="seasonal-garland__cord" />
      <svg x="4" y="11" width="26" height="26" viewBox="0 0 24 24">
        <ShapeGraphic name={name} />
      </svg>
    </svg>
  );
}

function Foco({ color, index }) {
  return (
    <svg className="seasonal-garland__bulb-segment" width="46" height="40" viewBox="0 0 46 40">
      <path d="M0 3Q23 17 46 3" className="seasonal-garland__cord" fill="none" />
      <rect x="20.5" y="9" width="5" height="5" rx="1" className="seasonal-garland__socket" />
      <g className="seasonal-garland__bulb" style={{ "--bulb": color, animationDelay: `${(index % 5) * 0.35}s` }}>
        <ellipse cx="23" cy="21" rx="4.6" ry="7" fill={color} />
        <ellipse cx="21.6" cy="18.5" rx="1.3" ry="2.4" fill="rgba(255,255,255,0.55)" />
      </g>
    </svg>
  );
}

const countFor = (itemWidth) => Math.ceil(window.innerWidth / itemWidth) + 2;

function useItemCount(itemWidth) {
  const [count, setCount] = useState(() => countFor(itemWidth));

  useEffect(() => {
    const onResize = () => setCount(countFor(itemWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [itemWidth]);

  return count;
}

function renderItem(season, i) {
  const color = season.colors[i % season.colors.length];

  if (season.garland === "luces") return <Foco key={i} color={color} index={i} />;

  if (season.garland === "papel-picado") {
    const motifs = season.motifs || ["flor"];
    return <PapelPicado key={i} color={color} motif={motifs[Math.floor(i / season.colors.length) % motifs.length]} />;
  }

  if (season.pendant && i % 4 === 3) return <Colgante key={i} name={season.pendant} />;
  const motif = season.motifs?.[0];
  // Figura en contraste: sobre un banderín blanco va del primer color.
  const motifColor = color.toLowerCase() === "#ffffff" ? season.colors[0] : "#ffffff";
  return <Banderin key={i} color={color} motif={motif} motifColor={motifColor} />;
}

export default function SeasonalGarland() {
  const { t } = useTranslation();
  const [season] = useState(getActiveSeason);
  const count = useItemCount(ITEM_WIDTH[season?.garland] || 50);

  if (!season) return null;

  const items = Array.from({ length: count }, (_, i) => renderItem(season, i));

  return (
    <div className={`seasonal-garland seasonal-garland--${season.garland}`} data-season={season.id}>
      <div className="seasonal-garland__row" aria-hidden="true">
        {items}
      </div>
      <p className="seasonal-garland__greeting">
        {season.icon && <SeasonalShape name={season.icon} color={season.iconColor} size={20} className="seasonal-garland__icon" />}
        <span>{t(`seasons.${season.id}.greeting`, { year: greetingYear() })}</span>
      </p>
    </div>
  );
}
