import { polygonArea, polygonPerimeter, wallSegmentsFromPolygon } from "./geometry";
import { zonaDe } from "./objetos";
import type { Habitacion, MaterialCatalogItem, TipoHabitacion } from "./types";

/** m² de muro sin descontar aberturas. */
export function areaMurosBruta(h: Habitacion): number {
  return wallSegmentsFromPolygon(h.puntos).reduce((sum, s) => sum + s.length * h.alturaM, 0);
}

export function areaAberturas(h: Habitacion): number {
  return h.aberturas.reduce((sum, a) => sum + a.anchoM * a.altoM, 0);
}

/** m² de muro real (para pintura, block, etc.) — bruta menos el área de puertas/ventanas. */
export function areaMurosNeta(h: Habitacion): number {
  return Math.max(0, areaMurosBruta(h) - areaAberturas(h));
}

export type PresupuestoLinea = {
  material: MaterialCatalogItem;
  cantidad: number;
  costo: number;
};

export function calcularPresupuesto(h: Habitacion, catalogo: MaterialCatalogItem[]): PresupuestoLinea[] {
  const fuentes: Record<MaterialCatalogItem["fuente"], number> = {
    area_muro: areaMurosNeta(h),
    area_piso: polygonArea(h.puntos),
    perimetro: polygonPerimeter(h.puntos),
  };
  const uso: TipoHabitacion = h.tipo ?? "otro";
  // Un material con "Aplica a" solo cuenta en las zonas de esos usos (p. ej. porcelanato solo en oficinas).
  return catalogo.filter((m) => !m.usos?.length || m.usos.includes(uso)).map((material) => {
    const cantidad = fuentes[material.fuente] * material.factor;
    return { material, cantidad, costo: cantidad * material.precioUnitario };
  });
}

export function totalPresupuesto(lineas: PresupuestoLinea[]): number {
  return lineas.reduce((sum, l) => sum + l.costo, 0);
}

/**
 * Catálogo de partida — precios y rendimientos de referencia (MXN) para calibrar, no cifras
 * oficiales de ningún proveedor. Edítalos en la pestaña Presupuesto para tu región/proveedor real.
 */
export const DEFAULT_CATALOGO: MaterialCatalogItem[] = [
  { id: "block", nombre: "Block / ladrillo", unidad: "pieza", fuente: "area_muro", factor: 12.5, precioUnitario: 8 },
  { id: "cemento", nombre: "Cemento", unidad: "saco", fuente: "area_muro", factor: 0.4, precioUnitario: 195 },
  { id: "arena", nombre: "Arena", unidad: "m³", fuente: "area_muro", factor: 0.04, precioUnitario: 450 },
  { id: "pintura", nombre: "Pintura", unidad: "litro", fuente: "area_muro", factor: 0.25, precioUnitario: 120 },
  { id: "piso", nombre: "Piso cerámico", unidad: "m²", fuente: "area_piso", factor: 1.1, precioUnitario: 180 },
  { id: "losa", nombre: "Concreto de losa (10cm)", unidad: "m³", fuente: "area_piso", factor: 0.1, precioUnitario: 2800 },
];

/** Niveles de acabado de referencia para la estimación de valor de mercado (MXN/m², a calibrar). */
export const NIVELES_ACABADO = [
  { id: "economico", nombre: "Económico", precioM2: 8000 },
  { id: "medio", nombre: "Medio", precioM2: 12000 },
  { id: "premium", nombre: "Premium", precioM2: 18000 },
];

export type PresupuestoZona = { tipo: TipoHabitacion; nombre: string; zonas: number; areaM2: number; costo: number };

/** Presupuesto de materiales sumado por tipo de zona (oficinas, baños, bodega…), de mayor a menor costo. */
export function presupuestoPorZona(habitaciones: Habitacion[], catalogo: MaterialCatalogItem[]): PresupuestoZona[] {
  const mapa = new Map<TipoHabitacion, PresupuestoZona>();
  for (const h of habitaciones) {
    if (h.puntos.length < 3) continue;
    const z = zonaDe(h.tipo);
    const fila = mapa.get(z.id) ?? { tipo: z.id, nombre: z.nombre, zonas: 0, areaM2: 0, costo: 0 };
    fila.zonas += 1;
    fila.areaM2 += polygonArea(h.puntos);
    fila.costo += totalPresupuesto(calcularPresupuesto(h, catalogo));
    mapa.set(z.id, fila);
  }
  return [...mapa.values()].sort((a, b) => b.costo - a.costo);
}

/**
 * Qué fracción del precio por m² base vale cada uso de zona. Antes todo lo construido valía lo mismo y lo
 * exterior nada; ahora una bodega, un pasillo o una cochera valen menos que una oficina. Todo es editable.
 */
export const FACTOR_VALOR_ZONA: Partial<Record<TipoHabitacion, number>> = {
  exterior: 0,
  cochera: 0.5,
  bodega: 0.6,
  pasillo: 0.8,
};

export type ValorZona = { tipo: TipoHabitacion; nombre: string; zonas: number; areaM2: number; factor: number; precioM2: number; valor: number };

export function valorPorZona(habitaciones: Habitacion[], precioBaseM2: number, factores: Partial<Record<TipoHabitacion, number>> = {}): ValorZona[] {
  const mapa = new Map<TipoHabitacion, ValorZona>();
  for (const h of habitaciones) {
    if (h.puntos.length < 3) continue;
    const z = zonaDe(h.tipo);
    const factor = factores[z.id] ?? FACTOR_VALOR_ZONA[z.id] ?? 1;
    const fila = mapa.get(z.id) ?? { tipo: z.id, nombre: z.nombre, zonas: 0, areaM2: 0, factor, precioM2: precioBaseM2 * factor, valor: 0 };
    fila.zonas += 1;
    fila.areaM2 += polygonArea(h.puntos);
    mapa.set(z.id, fila);
  }
  for (const f of mapa.values()) f.valor = f.areaM2 * f.precioM2;
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}
