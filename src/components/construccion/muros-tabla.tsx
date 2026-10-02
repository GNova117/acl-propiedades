import type { MuroFila } from "../../lib/construccion/contorno";

type Props = {
  titulo: string;
  muros: MuroFila[];
  /** Largo nuevo del muro `i`; false si no se pudo aplicar. */
  onLargo: (i: number, largoM: number) => boolean;
  /** Si viene, la columna de giro es editable (solo el contorno que se está dibujando). */
  onGiro?: (i: number, giroDeg: number) => boolean;
  /** Muro que cierra la figura (último punto → primer punto), solo informativo. */
  cierreM?: number;
  onHover?: (i: number | null) => void;
  hint?: string;
};

function Celda({ valor, min, step, onCommit, label, onFocusRow, onBlurRow }: { valor: number; min?: number; step: number; onCommit: (v: number) => boolean; label: string; onFocusRow?: () => void; onBlurRow?: () => void }) {
  return (
    <input
      key={valor}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      defaultValue={valor}
      aria-label={label}
      className="construccion-zonas__num"
      onFocus={(e) => {
        e.currentTarget.select();
        onFocusRow?.();
      }}
      onBlur={(e) => {
        onBlurRow?.();
        const v = Number(e.currentTarget.value.replace(",", "."));
        if (!Number.isFinite(v) || Math.abs(v - valor) < 0.005 || !onCommit(v)) e.currentTarget.value = String(valor);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = String(valor);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** Tabla de muros: cada fila es un muro con su largo (y su giro) editable; el plano se redibuja al instante. */
export default function MurosTabla({ titulo, muros, onLargo, onGiro, cierreM, onHover, hint }: Props) {
  return (
    <div className="construccion-zonas">
      <div className="construccion-zonas__titulo">{titulo}</div>
      {muros.length === 0 ? (
        <p className="construccion-panel__hint">{hint ?? "Sin muros todavía."}</p>
      ) : (
        <table className="construccion-zonas__table">
          <thead>
            <tr>
              <th>Muro</th>
              <th>Largo (m)</th>
              {onGiro && <th>Giro (°)</th>}
            </tr>
          </thead>
          <tbody>
            {muros.map((m, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <Celda valor={m.largoM} min={0.1} step={0.01} label={`Largo del muro ${i + 1}`} onCommit={(v) => v >= 0.1 && onLargo(i, v)} onFocusRow={() => onHover?.(i)} onBlurRow={() => onHover?.(null)} />
                </td>
                {onGiro && (
                  <td>
                    {m.giroDeg === null ? (
                      <span className="construccion-panel__muted">—</span>
                    ) : (
                      <Celda valor={m.giroDeg} step={1} label={`Giro del muro ${i + 1}`} onCommit={(v) => onGiro(i, v)} />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {cierreM !== undefined && cierreM > 0.005 && (
            <tfoot>
              <tr>
                <td>Cierre</td>
                <td colSpan={2}>{cierreM.toFixed(2)} m</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
      {hint && muros.length > 0 && <p className="construccion-panel__hint">{hint}</p>}
    </div>
  );
}
