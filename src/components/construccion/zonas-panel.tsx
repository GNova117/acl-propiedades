import { medidasRectangulo } from "../../lib/construccion/divisores";
import { polygonArea } from "../../lib/construccion/geometry";
import { ZONAS, zonaDe } from "../../lib/construccion/objetos";
import { areasPorZona } from "../../lib/construccion/stats";
import type { Habitacion, TipoHabitacion } from "../../lib/construccion/types";

type Props = {
  habitaciones: Habitacion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, nombre: string) => void;
  onTipo: (id: string, tipo: TipoHabitacion) => void;
  /** Cambia el ancho/largo de un cuarto rectangular (mueve su lado derecho/inferior; null si no se pudo). */
  onMedida: (id: string, eje: "ancho" | "largo", valorM: number) => boolean;
};

function MedidaInput({ valor, disabled, onCommit, label }: { valor: number | null; disabled: boolean; onCommit: (v: number) => boolean; label: string }) {
  return (
    <input
      // Cambia de `key` cuando el valor cambia por fuera (arrastrar una divisoria) para mostrar el número nuevo.
      key={valor ?? "x"}
      type="number"
      inputMode="decimal"
      step={0.05}
      min={0.2}
      disabled={disabled}
      defaultValue={valor ?? ""}
      aria-label={label}
      title={disabled ? "Solo se edita en cuartos rectangulares" : undefined}
      className="construccion-zonas__num"
      onBlur={(e) => {
        const v = Number(e.target.value.replace(",", "."));
        if (!(v > 0) || v === valor) {
          e.target.value = valor === null ? "" : String(valor);
          return;
        }
        if (!onCommit(v)) e.target.value = String(valor);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export default function ZonasPanel({ habitaciones, selectedId, onSelect, onRename, onTipo, onMedida }: Props) {
  if (habitaciones.length === 0) return null;
  const porTipo = areasPorZona(habitaciones);
  const total = habitaciones.reduce((s, h) => s + polygonArea(h.puntos), 0);
  return (
    <div className="construccion-zonas">
      <table className="construccion-zonas__table">
        <thead>
          <tr>
            <th>Zona</th>
            <th>Uso</th>
            <th>Ancho (m)</th>
            <th>Largo (m)</th>
            <th>m²</th>
          </tr>
        </thead>
        <tbody>
          {habitaciones.map((h) => {
            const m = medidasRectangulo(h);
            return (
              <tr key={h.id} className={h.id === selectedId ? "construccion-zonas__row--active" : undefined} onClick={() => onSelect(h.id)}>
                <td>
                  <input
                    value={h.nombre}
                    onChange={(e) => onRename(h.id, e.target.value)}
                    className="construccion-zonas__name"
                    aria-label="Nombre de la zona"
                    style={{ borderLeft: `4px solid ${zonaDe(h.tipo).color}` }}
                  />
                </td>
                <td>
                  <select value={h.tipo ?? "otro"} onChange={(e) => onTipo(h.id, e.target.value as TipoHabitacion)} aria-label="Uso de la zona">
                    {ZONAS.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <MedidaInput valor={m?.anchoM ?? null} disabled={!m} label="Ancho" onCommit={(v) => onMedida(h.id, "ancho", v)} />
                </td>
                <td>
                  <MedidaInput valor={m?.largoM ?? null} disabled={!m} label="Largo" onCommit={(v) => onMedida(h.id, "largo", v)} />
                </td>
                <td>{polygonArea(h.puntos).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total</td>
            <td>{total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="construccion-zonas__tipos">
        {porTipo.map((t) => (
          <span key={t.tipo} className="construccion-zonas__chip" style={{ borderColor: zonaDe(t.tipo as TipoHabitacion).color }}>
            {t.nombre}: <strong>{t.areaM2.toFixed(1)} m²</strong>
            {t.zonas > 1 ? ` (${t.zonas})` : ""}
          </span>
        ))}
      </div>
      <p className="construccion-panel__hint">Al cambiar ancho o largo se mueve el lado derecho/inferior; si es una divisoria compartida, la zona vecina se ajusta con ella. También puedes arrastrar la divisoria en el plano.</p>
    </div>
  );
}
