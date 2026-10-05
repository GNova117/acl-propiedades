import type { PointerEvent as ReactPointerEvent } from "react";
import { FAMILIAS_INSTALACION, objetoDef, zonaDe } from "../../lib/construccion/objetos";
import { geometriaEscalera } from "../../lib/construccion/escaleras";
import type { Objeto } from "../../lib/construccion/types";

type Props = {
  objetos: Objeto[];
  selectedId: string | null;
  /** Desnivel real de las escaleras que unen niveles (id de objeto → m); sin él vale la altura del catálogo. */
  rises?: Record<string, number>;
  onPointerDown?: (e: ReactPointerEvent<SVGElement>, o: Objeto) => void;
};

/** Dibuja los muebles/equipos sobre el plano (rectángulo o círculo, con giro y etiqueta). */
export default function ObjetosLayer({ objetos, selectedId, rises, onPointerDown }: Props) {
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
            {def?.instalacion ? (
              (() => {
                const fam = FAMILIAS_INSTALACION[def.instalacion.familia];
                const r = Math.max(0.09, Math.max(o.anchoM, o.largoM) / 2);
                return (
                  <>
                    <circle r={Math.max(r, 0.15)} fill="transparent" />
                    <circle r={r} fill="#ffffff" stroke={selected ? "#dc2626" : fam.color} strokeWidth={selected ? 0.05 : 0.03} />
                    <text transform={`rotate(${-o.rotDeg})`} fontSize={def.instalacion.glifo.length > 1 ? r * 0.8 : r * 1.1} fontWeight={700} fill={fam.color} textAnchor="middle" dominantBaseline="central" pointerEvents="none">
                      {def.instalacion.glifo}
                    </text>
                  </>
                );
              })()
            ) : def?.tipoEspecial ? (
              (() => {
                const geo = geometriaEscalera(def.tipoEspecial, o.anchoM, o.largoM, rises?.[o.id] ?? def.altoM);
                const trazo = selected ? "#dc2626" : zona.color;
                return (
                  <>
                    <polygon points={geo.contorno.map((p) => `${p.x},${p.z}`).join(" ")} fill="#ffffff" fillOpacity={0.7} stroke={trazo} strokeWidth={selected ? 0.07 : 0.045} />
                    {geo.peldanos.map(([a, b], i) => (
                      <line key={i} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke={zona.color} strokeWidth={0.02} />
                    ))}
                    <polyline points={geo.flecha.map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke={zona.color} strokeWidth={0.04} strokeLinejoin="round" strokeLinecap="round" />
                    {geo.poste && <circle r={geo.poste} fill={zona.color} />}
                    <text transform={`rotate(${-o.rotDeg})`} fontSize={0.18} fontWeight={700} fill={zona.color} textAnchor="middle" dominantBaseline="middle" pointerEvents="none" y={def.tipoEspecial === "escalera_caracol" ? 0.35 : 0}>
                      SUBE
                    </text>
                  </>
                );
              })()
            ) : round ? (
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
            {fits && !def?.tipoEspecial && !def?.instalacion && (
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
