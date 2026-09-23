import { KITS, OBJETOS_CATALOGO, ZONAS, type Kit } from "../../lib/construccion/objetos";
import type { TipoHabitacion } from "../../lib/construccion/types";

type Props = {
  categoria: TipoHabitacion;
  onCategoria: (c: TipoHabitacion) => void;
  placing: string | null;
  onPick: (defId: string | null) => void;
  onKit: (kit: Kit) => void;
};

/** Catálogo de objetos por zona (cocina, sala, recámara…) + paquetes que se colocan juntos. */
export default function ObjetosPalette({ categoria, onCategoria, placing, onPick, onKit }: Props) {
  const items = OBJETOS_CATALOGO.filter((o) => o.categoria === categoria);
  const kits = KITS.filter((k) => k.categoria === categoria);
  return (
    <section className="construccion-palette">
      <h3 className="construccion-palette__title">Objetos</h3>
      <div className="construccion-palette__cats">
        {ZONAS.filter((z) => z.id !== "otro").map((z) => (
          <button
            key={z.id}
            onClick={() => onCategoria(z.id)}
            className={`construccion-palette__cat${z.id === categoria ? " construccion-palette__cat--active" : ""}`}
            style={z.id === categoria ? { background: z.color, borderColor: z.color } : undefined}
          >
            {z.nombre}
          </button>
        ))}
      </div>
      {kits.map((k) => (
        <button key={k.id} onClick={() => onKit(k)} className="construccion-palette__kit" title="Coloca todas las piezas juntas">
          + {k.nombre}
        </button>
      ))}
      <ul className="construccion-palette__list">
        {items.map((o) => (
          <li key={o.id}>
            <button
              onClick={() => onPick(placing === o.id ? null : o.id)}
              className={`construccion-palette__item${placing === o.id ? " construccion-palette__item--active" : ""}`}
            >
              <span>{o.nombre}</span>
              <span className="construccion-palette__size">
                {o.anchoM}×{o.largoM} m
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
