import type { Bounds } from "../../lib/construccion/geometry";
import { gridStep } from "./use-plan-viewport";

/**
 * Cuadrícula que solo cubre la parte visible del plano (el lienzo ya no tiene límite). Las líneas
 * usan `non-scaling-stroke`: grosor de 1 px sin importar el zoom. Lleva la clase
 * `construccion-plan-grid` para quitarla al exportar.
 */
export default function PlanGrid({ visible, paso }: { visible: Bounds; paso?: number | null }) {
  const ancho = visible.maxX - visible.minX;
  const auto = gridStep(ancho);
  // Con un imán fijo la cuadrícula lo muestra (si no resulta demasiado densa para verse).
  const step = paso && ancho / paso <= 90 ? paso : auto;
  const major = step >= 1 ? step * 5 : Math.abs(1 / step - Math.round(1 / step)) < 1e-6 ? 1 : step * 5;
  const lines = [];
  const x0 = Math.floor(visible.minX / step) * step;
  const z0 = Math.floor(visible.minZ / step) * step;
  for (let x = x0; x <= visible.maxX; x += step) {
    const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    lines.push(
      <line key={`gx${x.toFixed(3)}`} x1={x} y1={visible.minZ} x2={x} y2={visible.maxZ} stroke={isMajor ? "#e4e4e7" : "#f1f1f3"} strokeWidth={1} vectorEffect="non-scaling-stroke" />,
    );
  }
  for (let z = z0; z <= visible.maxZ; z += step) {
    const isMajor = Math.abs(z / major - Math.round(z / major)) < 1e-6;
    lines.push(
      <line key={`gz${z.toFixed(3)}`} x1={visible.minX} y1={z} x2={visible.maxX} y2={z} stroke={isMajor ? "#e4e4e7" : "#f1f1f3"} strokeWidth={1} vectorEffect="non-scaling-stroke" />,
    );
  }
  return <g className="construccion-plan-grid" pointerEvents="none">{lines}</g>;
}
