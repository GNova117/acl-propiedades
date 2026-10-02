import type { WallSegment, Point } from "../../lib/construccion/geometry";
import { pointInPolygon } from "../../lib/construccion/geometry";
import { espejoDe } from "../../lib/construccion/aberturasMapa";
import type { Abertura, Habitacion } from "../../lib/construccion/types";

const WALL_T = 0.15;

/** +1 si el interior de la zona queda del lado (−sen a, cos a) del muro, −1 si queda del otro. */
export function ladoInterior(puntos: Point[], seg: WallSegment): 1 | -1 {
  const nx = -Math.sin(seg.angle);
  const nz = Math.cos(seg.angle);
  const probe = { x: seg.center.x + nx * 0.12, z: seg.center.z + nz * 0.12 };
  return pointInPolygon(probe, puntos) ? 1 : -1;
}

/** ids de aberturas que son el "otro lado" de una puerta ya dibujada por otra zona (no repiten la hoja). */
export function aberturasRepetidas(habs: Habitacion[]): Set<string> {
  const out = new Set<string>();
  for (const h of habs) {
    for (const a of h.aberturas) {
      const e = espejoDe(habs, h.id, a.id);
      if (e && e.ab.id < a.id) out.add(a.id);
    }
  }
  return out;
}

type Props = {
  seg: WallSegment;
  ab: Abertura;
  /** Color de relleno de la zona: tapa el muro en el hueco. */
  relleno: string;
  lado: 1 | -1;
  /** false si otra zona ya dibuja la hoja de esta puerta. */
  dibujarHoja?: boolean;
  selected?: boolean;
};

/**
 * Puerta o ventana en el plano, en lenguaje de plano arquitectónico: la puerta con su hoja abierta 90° y el
 * arco de giro hacia el interior de la zona; la ventana con su vidrio (marco doble) dentro del muro.
 */
export default function AberturaSvg({ seg, ab, relleno, lado, dibujarHoja = true, selected = false }: Props) {
  const w = Math.min(ab.anchoM, Math.max(seg.length, 0.1));
  const x0 = ab.offsetM - w / 2;
  const x1 = ab.offsetM + w / 2;
  const grados = (seg.angle * 180) / Math.PI;
  const esPuerta = ab.tipo === "puerta";
  const color = esPuerta ? "#92400e" : "#0369a1";
  return (
    <g transform={`translate(${seg.start.x} ${seg.start.z}) rotate(${grados})`} pointerEvents="none">
      {selected && <rect x={x0 - 0.08} y={-WALL_T} width={w + 0.16} height={WALL_T * 2} rx={0.08} fill="#2563eb" fillOpacity={0.25} />}
      <rect x={x0} y={-WALL_T / 2 - 0.012} width={w} height={WALL_T + 0.024} fill={relleno} />
      {esPuerta ? (
        <>
          <line x1={x0} y1={-WALL_T / 2} x2={x0} y2={WALL_T / 2} stroke={color} strokeWidth={0.05} />
          <line x1={x1} y1={-WALL_T / 2} x2={x1} y2={WALL_T / 2} stroke={color} strokeWidth={0.05} />
          {dibujarHoja && (
            <>
              <line x1={x0} y1={0} x2={x0} y2={lado * w} stroke={color} strokeWidth={0.05} strokeLinecap="round" />
              <path d={`M ${x1} 0 A ${w} ${w} 0 0 ${lado === 1 ? 1 : 0} ${x0} ${lado * w}`} fill="none" stroke={color} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
            </>
          )}
        </>
      ) : (
        <>
          <rect x={x0} y={-WALL_T / 2} width={w} height={WALL_T} fill="#ffffff" stroke={color} strokeWidth={0.025} />
          <line x1={x0} y1={0} x2={x1} y2={0} stroke={color} strokeWidth={0.03} />
          <line x1={x0} y1={-WALL_T / 6} x2={x1} y2={-WALL_T / 6} stroke={color} strokeWidth={0.012} strokeOpacity={0.6} />
          <line x1={x0} y1={WALL_T / 6} x2={x1} y2={WALL_T / 6} stroke={color} strokeWidth={0.012} strokeOpacity={0.6} />
        </>
      )}
    </g>
  );
}
