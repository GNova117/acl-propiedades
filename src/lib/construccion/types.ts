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

/** Zona/uso de una habitación — decide el color en el plano y qué objetos se sugieren primero. */
export type TipoHabitacion =
  | "sala"
  | "cocina"
  | "comedor"
  | "recamara"
  | "bano"
  | "lavanderia"
  | "estudio"
  | "cochera"
  | "exterior"
  | "otro";

/** Mueble/equipo colocado en el plano. Coordenadas absolutas (m), igual que los puntos de las habitaciones. */
export type Objeto = {
  id: string;
  /** Clave del catálogo (`OBJETOS_CATALOGO`). */
  tipo: string;
  /** Habitación que lo contiene (se mueve junto con ella); null si está suelto o afuera. */
  habitacionId: string | null;
  /** Centro del objeto. */
  x: number;
  z: number;
  anchoM: number;
  largoM: number;
  /** Giro en grados (0/90/180/270 desde los botones). */
  rotDeg: number;
};

export type Habitacion = {
  id: string;
  nombre: string;
  tipo?: TipoHabitacion;
  puntos: Point[];
  alturaM: number;
  aberturas: Abertura[];
};

export type Proyecto = {
  id: string;
  nombre: string;
  habitaciones: Habitacion[];
  objetos: Objeto[];
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
