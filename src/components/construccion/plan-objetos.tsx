import type { PointerEvent as ReactPointerEvent } from "react";
import { objetoDef, zonaDe } from "../../lib/construccion/objetos";
import type { Objeto } from "../../lib/construccion/types";

type Props = {
  objetos: Objeto[];
  selectedId: string | null;
  onPointerDown?: (e: ReactPointerEvent<SVGElement>, o: Objeto) => void;
};

/** Dibuja los muebles/equipos sobre el plano (rectángulo o círculo, con giro y etiqueta). */
export default function ObjetosLayer({ objetos, selectedId, onPointerDown }: Props) {
  return (
    <g>
      {objetos.map((o) => {
        const def = objetoDef(o.tipo);
        const zona = zonaDe(def?.categoria);
        const selected = o.id === selectedId;
        const round = def?.forma === "round";
        const short = def ? def.nombre.split(" ")[0].replace(/[/,]$/, "") : "?";
        const fits = Math.min(o.anchoM, o.largoM) >= 0.55 || Math.max(o.anchoM, o.largoM) >= 1.2;
        return (
          <g
            key={o.id}
            transform={`translate(${o.x} ${o.z}) rotate(${o.rotDeg})`}
            onPointerDown={onPointerDown ? (e) => onPointerDown(e, o) : undefined}
            className="construccion-objeto"
          >
            {round ? (
              <ellipse
                rx={o.anchoM / 2}
                ry={o.largoM / 2}
                fill={zona.color}
                fillOpacity={0.22}
                stroke={selected ? "#dc2626" : zona.color}
                strokeWidth={selected ? 0.07 : 0.035}
              />
            ) : (
              <rect
                x={-o.anchoM / 2}
                y={-o.largoM / 2}
                width={o.anchoM}
                height={o.largoM}
                rx={0.05}
                fill={zona.color}
                fillOpacity={0.22}
                stroke={selected ? "#dc2626" : zona.color}
                strokeWidth={selected ? 0.07 : 0.035}
              />
            )}
            {fits && (
              <text
                transform={`rotate(${-o.rotDeg})`}
                fontSize={0.2}
                fill="#27272a"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {short}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
