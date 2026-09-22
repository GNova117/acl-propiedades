import type { Point } from "./geometry";

export type TipoAbertura = "puerta" | "ventana";

export type Abertura = {
  id: string;
  /** Índice del segmento de muro (0..n-1) sobre el que cae esta abertura, dentro del polígono de la habitación. */
  segmentIndex: number;
  tipo: TipoAbertura;
  offsetM: number;
  anchoM: number;
  altoM: number;
  /** Altura del borde inferior de la abertura sobre el piso (0 para puertas, ~1m típico en ventanas). */
  altoDesdePisoM: number;
};

export type Habitacion = {
  id: string;
  nombre: string;
  puntos: Point[];
  alturaM: number;
  aberturas: Abertura[];
};

export type Proyecto = {
  id: string;
  nombre: string;
  habitaciones: Habitacion[];
};

export const ABERTURA_DEFAULTS: Record<TipoAbertura, { altoM: number; altoDesdePisoM: number }> = {
  puerta: { altoM: 2.1, altoDesdePisoM: 0 },
  ventana: { altoM: 1.2, altoDesdePisoM: 1.0 },
};

/** De qué cantidad de la habitación depende un material del catálogo. */
export type FuenteCantidad = "area_muro" | "area_piso" | "perimetro";

export type MaterialCatalogItem = {
  id: string;
  nombre: string;
  unidad: string;
  fuente: FuenteCantidad;
  /** Cantidad de `unidad` requerida por cada unidad de `fuente` (m² o m). */
  factor: number;
  precioUnitario: number;
};
