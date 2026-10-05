// Datos de la propiedad que salen del plano: m² construidos, recámaras, baños, cajones, plantas… para llenar la
// ficha de la propiedad sin volver a capturarlos.
import { resumenAcabados } from "./acabados";
import { polygonArea } from "./geometry";
import { esAreaExterior, estadisticasProyecto, indicadoresTerreno } from "./stats";
import type { Proyecto } from "./types";

/** Un baño de menos de esta superficie (m²) cuenta como medio baño. */
const MEDIO_BANO_M2 = 3.0;
/** Si no hay autos dibujados, cada tanto de cochera cuenta como un cajón. */
const M2_POR_CAJON = 13;

export type DatosPropiedad = {
  areaM2: number;
  recamaras: number;
  banos: number;
  cajones: number;
  alturaLibreM: number | null;
  niveles: number;
  terrenoM2: number | null;
  cos: number | null;
  cus: number | null;
  acabados: string;
  techumbre: string;
};

const redondear = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function datosDePropiedad(p: Proyecto): DatosPropiedad {
  const zonas = p.habitaciones.filter((h) => h.puntos.length >= 3 && h.tipo !== "terreno");
  const stats = estadisticasProyecto(p);
  const recamaras = zonas.filter((h) => h.tipo === "recamara").length;
  const banos = zonas.filter((h) => h.tipo === "bano").reduce((s, h) => s + (polygonArea(h.puntos) < MEDIO_BANO_M2 ? 0.5 : 1), 0);
  const autos = p.objetos.filter((o) => o.tipo === "auto").length;
  const cocheraM2 = zonas.filter((h) => h.tipo === "cochera").reduce((s, h) => s + polygonArea(h.puntos), 0);
  const cajones = autos > 0 ? autos : Math.floor(cocheraM2 / M2_POR_CAJON);
  const base = p.niveles[0]?.id;
  const alturas = zonas.filter((h) => h.nivelId === base && !esAreaExterior(h)).map((h) => h.alturaM);
  const t = indicadoresTerreno(p);
  const { acabados, techumbre } = resumenAcabados(zonas);
  return {
    areaM2: redondear(stats.construidaM2),
    recamaras,
    banos,
    cajones,
    alturaLibreM: alturas.length ? Math.max(...alturas) : null,
    niveles: new Set(zonas.filter((h) => !esAreaExterior(h)).map((h) => h.nivelId)).size,
    terrenoM2: t ? redondear(t.terrenoM2) : null,
    cos: t ? redondear(t.cos, 3) : null,
    cus: t ? redondear(t.cus, 3) : null,
    acabados,
    techumbre,
  };
}

/** Resumen en texto para pegar en una descripción, un mensaje o una nota. */
export function resumenEnTexto(p: Proyecto, d: DatosPropiedad = datosDePropiedad(p)): string {
  const lineas = [
    `${p.nombre}${p.direccion ? ` — ${p.direccion}` : ""}`,
    `Construcción: ${d.areaM2.toFixed(1)} m² en ${d.niveles} nivel${d.niveles === 1 ? "" : "es"}`,
    `${d.recamaras} recámara${d.recamaras === 1 ? "" : "s"} · ${d.banos} baño${d.banos === 1 ? "" : "s"} · ${d.cajones} ${d.cajones === 1 ? "cajón" : "cajones"} de estacionamiento`,
  ];
  if (d.terrenoM2) lineas.push(`Terreno: ${d.terrenoM2.toFixed(1)} m² · ocupación ${(d.cos! * 100).toFixed(0)} % · utilización ${d.cus!.toFixed(2)} veces`);
  if (d.alturaLibreM) lineas.push(`Altura libre: ${d.alturaLibreM.toFixed(2)} m`);
  if (d.acabados) lineas.push(d.acabados);
  if (d.techumbre) lineas.push(`Techumbre: ${d.techumbre}`);
  return lineas.join("\n");
}
