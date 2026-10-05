// Acabados por zona (piso, muros y techo): cada elección trae su color para el render 3D, su forma (en el
// techo) y un precio de referencia por m² que entra al presupuesto. Los precios son de partida y se
// ajustan en la pestaña Presupuesto (solo se guardan en este navegador).
import type { Habitacion } from "./types";

export type ParteAcabado = "piso" | "pared" | "techo";
export type FormaTecho = "plano" | "dos_aguas" | "cuatro_aguas" | "ninguno";

export type Acabado = {
  id: string;
  nombre: string;
  color: string;
  /** MXN por m² suministrado y colocado (referencia). */
  precioM2: number;
  forma?: FormaTecho;
  /** Cuánto se compra por cada m² de superficie (merma, o más superficie en techos inclinados). */
  factor?: number;
};

export type AcabadosZona = { piso?: string; pared?: string; techo?: string };

export const PISOS: Acabado[] = [
  { id: "ceramica", nombre: "Cerámica beige", color: "#e7d8c0", precioM2: 380, factor: 1.1 },
  { id: "porcelanato", nombre: "Porcelanato gris", color: "#d4d4d8", precioM2: 650, factor: 1.1 },
  { id: "madera", nombre: "Madera / laminado", color: "#b08850", precioM2: 780, factor: 1.08 },
  { id: "concreto", nombre: "Concreto pulido", color: "#a8a29e", precioM2: 420, factor: 1.0 },
  { id: "loseta", nombre: "Loseta / mosaico", color: "#c9b99a", precioM2: 450, factor: 1.1 },
  { id: "epoxico", nombre: "Epóxico industrial", color: "#94a3b8", precioM2: 560, factor: 1.0 },
  { id: "adoquin", nombre: "Adoquín / concreto estampado", color: "#cbd5e1", precioM2: 520, factor: 1.05 },
  { id: "pasto", nombre: "Pasto", color: "#86efac", precioM2: 90, factor: 1.0 },
];

export const PAREDES: Acabado[] = [
  { id: "pintura_blanca", nombre: "Pintura blanca", color: "#f5f5f4", precioM2: 95 },
  { id: "pintura_crema", nombre: "Pintura crema", color: "#f3e8d0", precioM2: 95 },
  { id: "pintura_gris", nombre: "Pintura gris", color: "#cbd5e1", precioM2: 95 },
  { id: "pintura_azul", nombre: "Pintura azul", color: "#bfdbfe", precioM2: 95 },
  { id: "pintura_verde", nombre: "Pintura verde", color: "#bbf7d0", precioM2: 95 },
  { id: "tirol", nombre: "Tirol / textura", color: "#e7e5e4", precioM2: 110 },
  { id: "azulejo", nombre: "Azulejo (baño / cocina)", color: "#bae6fd", precioM2: 520 },
  { id: "tabique", nombre: "Tabique aparente", color: "#c2703d", precioM2: 320 },
  { id: "concreto", nombre: "Concreto aparente", color: "#9ca3af", precioM2: 280 },
  { id: "madera", nombre: "Recubrimiento de madera", color: "#a16207", precioM2: 900 },
];

export const TECHOS: Acabado[] = [
  { id: "losa", nombre: "Losa plana de concreto", color: "#a8a29e", precioM2: 1500, forma: "plano", factor: 1.0 },
  { id: "dos_aguas_teja", nombre: "Dos aguas, teja", color: "#b45309", precioM2: 1900, forma: "dos_aguas", factor: 1.25 },
  { id: "cuatro_aguas_teja", nombre: "Cuatro aguas, teja", color: "#9a3412", precioM2: 2100, forma: "cuatro_aguas", factor: 1.3 },
  { id: "dos_aguas_lamina", nombre: "Dos aguas, lámina", color: "#64748b", precioM2: 950, forma: "dos_aguas", factor: 1.2 },
  { id: "ninguno", nombre: "Sin techo (abierto)", color: "#e5e7eb", precioM2: 0, forma: "ninguno", factor: 1.0 },
];

const CATALOGOS: Record<ParteAcabado, Acabado[]> = { piso: PISOS, pared: PAREDES, techo: TECHOS };
export const catalogoDe = (parte: ParteAcabado) => CATALOGOS[parte];
export const acabadoDe = (parte: ParteAcabado, id: string | undefined): Acabado | undefined => (id ? CATALOGOS[parte].find((a) => a.id === id) : undefined);

// ── Precios que el usuario ajusta (por navegador) ──
const CLAVE_PRECIOS = "construccion:precios-acabados";

export function leerPreciosAcabados(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE_PRECIOS) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function guardarPrecioAcabado(parte: ParteAcabado, id: string, precio: number | null) {
  const actual = leerPreciosAcabados();
  const clave = `${parte}:${id}`;
  if (precio === null) delete actual[clave];
  else actual[clave] = precio;
  try {
    window.localStorage.setItem(CLAVE_PRECIOS, JSON.stringify(actual));
  } catch {
    /* sin almacenamiento: el cambio vale solo mientras la pestaña esté abierta */
  }
}

export function precioDeAcabado(parte: ParteAcabado, a: Acabado, precios: Record<string, number> = leerPreciosAcabados()): number {
  return precios[`${parte}:${a.id}`] ?? a.precioM2;
}

/** Acabados distintos que usa un conjunto de zonas (para listar sus precios). */
export function acabadosEnUso(habitaciones: Habitacion[]): { parte: ParteAcabado; acabado: Acabado }[] {
  const vistos = new Set<string>();
  const out: { parte: ParteAcabado; acabado: Acabado }[] = [];
  for (const h of habitaciones) {
    for (const parte of ["piso", "pared", "techo"] as const) {
      const a = acabadoDe(parte, h.acabados?.[parte]);
      if (a && !vistos.has(`${parte}:${a.id}`)) {
        vistos.add(`${parte}:${a.id}`);
        out.push({ parte, acabado: a });
      }
    }
  }
  return out;
}

/** Texto corto para la ficha de la propiedad ("Pisos: porcelanato en sala y cocina; …"). */
export function resumenAcabados(habitaciones: Habitacion[]): { acabados: string; techumbre: string } {
  const por = (parte: ParteAcabado) => {
    const grupos = new Map<string, number>();
    for (const h of habitaciones) {
      const a = acabadoDe(parte, h.acabados?.[parte]);
      if (a) grupos.set(a.nombre, (grupos.get(a.nombre) ?? 0) + 1);
    }
    return [...grupos.entries()].map(([nombre, n]) => (n > 1 ? `${nombre} (${n} zonas)` : nombre));
  };
  const partes = [
    por("piso").length ? `Pisos: ${por("piso").join(", ")}` : "",
    por("pared").length ? `Muros: ${por("pared").join(", ")}` : "",
  ].filter(Boolean);
  return { acabados: partes.join(". "), techumbre: por("techo").join(", ") };
}
