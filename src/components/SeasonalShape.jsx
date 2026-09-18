// Figuras de las plantillas de temporada (src/lib/seasons.js), todas en un
// viewBox de 24×24 para que partículas, iconos del saludo y colgantes de la
// guirnalda compartan el mismo dibujo a cualquier tamaño.

const ring = (count, radius, r, offset = 0) =>
  Array.from({ length: count }, (_, i) => {
    const angle = ((i / count) * 360 + offset) * (Math.PI / 180);
    return { cx: 12 + radius * Math.cos(angle), cy: 12 + radius * Math.sin(angle), r };
  });

const FLOWER_PETALS = ring(10, 6.4, 3.3);
const FLOWER_INNER = ring(7, 3.1, 2.3, 20);

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 === 0 ? 10.5 : 4.4;
  const angle = (-90 + i * 36) * (Math.PI / 180);
  return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12.6 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

const SNOW_ARMS = [0, 60, 120, 180, 240, 300].map((deg) => deg * (Math.PI / 180));

const BAT_PATH =
  "M12 9.2 L12.9 7.6 L13.5 9.6 C14.8 9.4 16.5 8.4 17.6 7.2 C19.5 8.2 21.8 8.6 23.5 8.2 " +
  "C22.4 9.6 21.8 11.2 21.9 12.8 C20.8 12 19.4 12.1 18.4 13 C17.6 12.3 16.2 12.4 15.3 13.4 " +
  "C14.4 13.2 13.2 13.8 12.6 15.4 L12 16.4 L11.4 15.4 C10.8 13.8 9.6 13.2 8.7 13.4 " +
  "C7.8 12.4 6.4 12.3 5.6 13 C4.6 12.1 3.2 12 2.1 12.8 C2.2 11.2 1.6 9.6 0.5 8.2 " +
  "C2.2 8.6 4.5 8.2 6.4 7.2 C7.5 8.4 9.2 9.4 10.5 9.6 L11.1 7.6 Z";

const HEART_PATH =
  "M12 21.2l-1.3-1.2C5.6 15.4 2.2 12.3 2.2 8.5 2.2 5.4 4.6 3 7.7 3c1.7 0 3.4.8 4.3 2.1" +
  "C13 3.8 14.6 3 16.3 3c3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.4 6.9-8.5 11.5L12 21.2z";

const BELL_PATH =
  "M12 2.6a1.3 1.3 0 0 1 1.3 1.3v.8c2.9.7 4.8 3.2 4.8 6.2v3.8l2 2.7H3.9l2-2.7v-3.8" +
  "c0-3 1.9-5.5 4.8-6.2v-.8A1.3 1.3 0 0 1 12 2.6z";

// Solo el dibujo, sin <svg> raíz: para meterlo dentro de otro SVG
// (banderines y colgantes de la guirnalda).
export function ShapeGraphic({ name, color = "currentColor" }) {
  switch (name) {
    case "confeti":
      return <rect x="8" y="3" width="8" height="18" rx="1.5" fill={color} />;
    case "corazon":
      return <path d={HEART_PATH} fill={color} />;
    case "estrella":
      return <polygon points={STAR_POINTS} fill={color} />;
    case "campana":
      return (
        <>
          <path d={BELL_PATH} fill={color} />
          <circle cx="12" cy="19.6" r="2" fill={color} />
        </>
      );
    case "flor":
      return (
        <>
          {FLOWER_PETALS.map((c, i) => (
            <circle key={`p${i}`} {...c} fill={color} />
          ))}
          <circle cx="12" cy="12" r="5.6" fill="rgba(0,0,0,0.14)" />
          {FLOWER_INNER.map((c, i) => (
            <circle key={`i${i}`} {...c} fill={color} />
          ))}
          <circle cx="12" cy="12" r="2" fill="rgba(80,35,0,0.55)" />
        </>
      );
    case "nieve":
      return (
        <g stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none">
          {SNOW_ARMS.map((a, i) => {
            const x = 12 + 9.5 * Math.cos(a);
            const y = 12 + 9.5 * Math.sin(a);
            const bx = 12 + 6 * Math.cos(a);
            const by = 12 + 6 * Math.sin(a);
            const l = a - 0.7;
            const r = a + 0.7;
            return (
              <g key={i}>
                <line x1="12" y1="12" x2={x} y2={y} />
                <line x1={bx} y1={by} x2={bx + 3 * Math.cos(l)} y2={by + 3 * Math.sin(l)} />
                <line x1={bx} y1={by} x2={bx + 3 * Math.cos(r)} y2={by + 3 * Math.sin(r)} />
              </g>
            );
          })}
        </g>
      );
    case "murcielago":
      return <path d={BAT_PATH} fill={color} />;
    case "calabaza":
      return (
        <>
          <path d="M11.3 7.4c-.1-1.6.4-3 1.6-4l1.1 1c-.8.8-1.1 1.8-1 3z" fill="#4a7a2a" />
          <ellipse cx="7.8" cy="14.2" rx="5.2" ry="6.6" fill="#e56f0e" />
          <ellipse cx="16.2" cy="14.2" rx="5.2" ry="6.6" fill="#e56f0e" />
          <ellipse cx="12" cy="14" rx="4.6" ry="7" fill="#f68b1f" />
          <path d="M7.6 12.6l1.8-2.4 1.8 2.4zM12.8 12.6l1.8-2.4 1.8 2.4z" fill="#3a1f0b" />
          <path d="M7.2 15.6h9.6l-1 1.8-1.3-.9-1.2 1-1.3-1-1.2 1-1.3-1-1.3.9z" fill="#3a1f0b" />
        </>
      );
    default:
      return null;
  }
}

export default function SeasonalShape({ name, color = "currentColor", size = 24, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ShapeGraphic name={name} color={color} />
    </svg>
  );
}
