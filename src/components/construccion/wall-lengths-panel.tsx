import { wallSegmentsFromPolygon } from "../../lib/construccion/geometry";
import type { Habitacion } from "../../lib/construccion/types";

const MIN_WALL_M = 0.1;

type Props = {
  habitacion: Habitacion;
  /** Pide cambiar el largo del muro `index` a `lengthM` metros. */
  onChange: (index: number, lengthM: number) => void;
  /** Muro enfocado (para resaltarlo en el plano); null al salir. */
  onHighlight: (index: number | null) => void;
};

/**
 * "Medidas de los muros": cada muro con su largo editable en metros. Es el camino de captura
 * exacta (con láser o cinta, tecleando lo que marca). Al cambiar un largo se conservan los
 * ángulos rectos: en un rectángulo, el muro de enfrente se ajusta solo (ver `setWallLength`).
 */
export default function WallLengthsPanel({ habitacion, onChange, onHighlight }: Props) {
  const segments = wallSegmentsFromPolygon(habitacion.puntos);

  /** true si el valor se aplicó; false si era inválido o no cambió nada. */
  function commit(index: number, current: number, raw: string): boolean {
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value < MIN_WALL_M || Math.abs(value - current) < 0.005) return false;
    onChange(index, Math.round(value * 1000) / 1000);
    return true;
  }

  return (
    <div className="construccion-walls">
      <p className="construccion-editor__aberturas-hint">
        Medidas de los muros — teclea el largo exacto (el muro se alarga hacia el siguiente vértice y los ángulos rectos se conservan)
      </p>
      <ul className="construccion-walls__list">
        {segments.map((seg, i) => {
          const current = Math.round(seg.length * 100) / 100;
          return (
            <li key={`${i}-${current}`} className="construccion-walls__row">
              <label className="construccion-editor__abertura-label">
                Muro {i + 1}
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  min={MIN_WALL_M}
                  defaultValue={current}
                  className="construccion-editor__abertura-input"
                  onFocus={(e) => {
                    e.currentTarget.select();
                    onHighlight(i);
                  }}
                  onBlur={(e) => {
                    onHighlight(null);
                    // Si no se aplicó (vacío, 0, texto o igual al actual) el campo vuelve al largo real:
                    // el campo no es controlado y, si no, se quedaría mostrando lo tecleado.
                    if (!commit(i, seg.length, e.currentTarget.value)) e.currentTarget.value = String(current);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = String(current);
                      e.currentTarget.blur();
                    }
                  }}
                />
                m
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
