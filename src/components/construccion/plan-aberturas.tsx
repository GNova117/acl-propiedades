import type { WallSegment, Point } from "../../lib/construccion/geometry";
import { pointInPolygon } from "../../lib/construccion/geometry";
import { espejoDe } from "../../lib/construccion/aberturasMapa";
import { estiloDe } from "../../lib/construccion/estilosAbertura";
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
  const xm = ab.offsetM;
  const grados = (seg.angle * 180) / Math.PI;
  const esPuerta = ab.tipo === "puerta";
  const estilo = estiloDe(ab);
  const color = esPuerta ? "#92400e" : "#0369a1";
  const azul = "#0369a1";
  const sweep = lado === 1 ? 1 : 0;
  const hoja = (xBisagra: number, largo: number, dir: 1 | -1, grosor: number, c: string) => (
    <>
      <line x1={xBisagra} y1={0} x2={xBisagra} y2={lado * largo} stroke={c} strokeWidth={grosor} strokeLinecap="round" />
      <path d={`M ${xBisagra + dir * largo} 0 A ${largo} ${largo} 0 0 ${dir === 1 ? sweep : 1 - sweep} ${xBisagra} ${lado * largo}`} fill="none" stroke={c} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
    </>
  );
  const jambas = (c: string) => (
    <>
      <line x1={x0} y1={-WALL_T / 2} x2={x0} y2={WALL_T / 2} stroke={c} strokeWidth={0.05} />
      <line x1={x1} y1={-WALL_T / 2} x2={x1} y2={WALL_T / 2} stroke={c} strokeWidth={0.05} />
    </>
  );
  return (
    <g transform={`translate(${seg.start.x} ${seg.start.z}) rotate(${grados})`} pointerEvents="none">
      {selected && <rect x={x0 - 0.08} y={-WALL_T} width={w + 0.16} height={WALL_T * 2} rx={0.08} fill="#2563eb" fillOpacity={0.25} />}
      <rect x={x0} y={-WALL_T / 2 - 0.012} width={w} height={WALL_T + 0.024} fill={relleno} />
      {esPuerta ? (
        <>
          {jambas(color)}
          {estilo === "doble" && dibujarHoja && (
            <>
              {hoja(x0, w / 2, 1, 0.05, color)}
              {hoja(x1, w / 2, -1, 0.05, color)}
            </>
          )}
          {(estilo === "interior" || estilo === "principal" || estilo === "vidrio") && dibujarHoja && hoja(x0, w, 1, estilo === "principal" ? 0.08 : 0.05, estilo === "vidrio" ? azul : color)}
          {estilo === "corrediza" && (
            <>
              <line x1={x0} y1={-0.04} x2={xm + w * 0.05} y2={-0.04} stroke={azul} strokeWidth={0.035} />
              <line x1={xm - w * 0.05} y1={0.04} x2={x1} y2={0.04} stroke={azul} strokeWidth={0.035} />
              <path d={`M ${xm - 0.12} -0.1 l 0.24 0 m -0.08 -0.05 l 0.08 0.05 l -0.08 0.05`} fill="none" stroke={azul} strokeWidth={0.015} />
            </>
          )}
          {estilo === "cochera" && (
            <>
              <line x1={x0} y1={-0.035} x2={x1} y2={-0.035} stroke="#57534e" strokeWidth={0.03} strokeDasharray="0.25 0.1" />
              <line x1={x0} y1={0.035} x2={x1} y2={0.035} stroke="#57534e" strokeWidth={0.03} strokeDasharray="0.25 0.1" />
            </>
          )}
          {estilo === "arco" && <line x1={x0} y1={0} x2={x1} y2={0} stroke={color} strokeWidth={0.015} strokeDasharray="0.04 0.07" />}
        </>
      ) : (
        <>
          <rect x={x0} y={-WALL_T / 2} width={w} height={WALL_T} fill="#ffffff" stroke={azul} strokeWidth={0.025} />
          {(estilo === "corrediza" || estilo === "ventanal") && (
            <>
              <line x1={x0} y1={-WALL_T / 5} x2={xm + w * 0.06} y2={-WALL_T / 5} stroke={azul} strokeWidth={estilo === "ventanal" ? 0.04 : 0.025} />
              <line x1={xm - w * 0.06} y1={WALL_T / 5} x2={x1} y2={WALL_T / 5} stroke={azul} strokeWidth={estilo === "ventanal" ? 0.04 : 0.025} />
            </>
          )}
          {estilo === "fija" && <line x1={x0} y1={0} x2={x1} y2={0} stroke={azul} strokeWidth={0.03} />}
          {estilo === "abatible" && (
            <>
              <line x1={x0} y1={0} x2={x1} y2={0} stroke={azul} strokeWidth={0.02} />
              <line x1={xm} y1={-WALL_T / 2} x2={xm} y2={WALL_T / 2} stroke={azul} strokeWidth={0.025} />
              {dibujarHoja && (
                <>
                  <line x1={x0} y1={0} x2={x0 + w * 0.32} y2={lado * w * 0.32} stroke={azul} strokeWidth={0.015} strokeDasharray="0.06 0.04" />
                  <line x1={x1} y1={0} x2={x1 - w * 0.32} y2={lado * w * 0.32} stroke={azul} strokeWidth={0.015} strokeDasharray="0.06 0.04" />
                </>
              )}
            </>
          )}
          {estilo === "bano" && <line x1={x0} y1={0} x2={x1} y2={0} stroke={azul} strokeWidth={0.03} strokeDasharray="0.06 0.05" />}
        </>
      )}
    </g>
  );
}
