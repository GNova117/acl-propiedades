import { polygonArea, polygonPerimeter, wallSegmentsFromPolygon } from "./geometry";
import type { Habitacion, MaterialCatalogItem } from "./types";

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
  return catalogo.map((material) => {
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
