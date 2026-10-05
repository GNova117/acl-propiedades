// Variedad de puertas y ventanas: cada estilo trae sus medidas de partida y se dibuja distinto en el plano y en 3D.
import type { TipoAbertura } from "./types";

export type EstiloPuerta = "interior" | "principal" | "doble" | "vidrio" | "corrediza" | "cochera" | "arco";
export type EstiloVentana = "corrediza" | "fija" | "abatible" | "ventanal" | "bano";
export type EstiloAbertura = EstiloPuerta | EstiloVentana;

export type EstiloDef = { id: EstiloAbertura; nombre: string; anchoM: number; altoM: number; altoDesdePisoM: number };

export const ESTILOS_PUERTA: (EstiloDef & { id: EstiloPuerta })[] = [
  { id: "interior", nombre: "Interior (tabique)", anchoM: 0.9, altoM: 2.1, altoDesdePisoM: 0 },
  { id: "principal", nombre: "Principal (madera con paneles)", anchoM: 1.0, altoM: 2.2, altoDesdePisoM: 0 },
  { id: "doble", nombre: "Doble hoja", anchoM: 1.6, altoM: 2.1, altoDesdePisoM: 0 },
  { id: "vidrio", nombre: "De vidrio (aluminio)", anchoM: 0.9, altoM: 2.1, altoDesdePisoM: 0 },
  { id: "corrediza", nombre: "Corrediza de vidrio", anchoM: 2.0, altoM: 2.1, altoDesdePisoM: 0 },
  { id: "cochera", nombre: "Portón de cochera", anchoM: 2.6, altoM: 2.2, altoDesdePisoM: 0 },
  { id: "arco", nombre: "Arco / vano sin hoja", anchoM: 1.0, altoM: 2.2, altoDesdePisoM: 0 },
];

export const ESTILOS_VENTANA: (EstiloDef & { id: EstiloVentana })[] = [
  { id: "corrediza", nombre: "Corrediza", anchoM: 1.2, altoM: 1.2, altoDesdePisoM: 1.0 },
  { id: "fija", nombre: "Fija (un vidrio)", anchoM: 1.2, altoM: 1.2, altoDesdePisoM: 1.0 },
  { id: "abatible", nombre: "Abatible (dos hojas)", anchoM: 1.0, altoM: 1.2, altoDesdePisoM: 1.0 },
  { id: "ventanal", nombre: "Ventanal (piso a techo)", anchoM: 2.0, altoM: 2.3, altoDesdePisoM: 0 },
  { id: "bano", nombre: "De baño (alta, esmerilada)", anchoM: 0.6, altoM: 0.5, altoDesdePisoM: 1.7 },
];

export const estilosDe = (tipo: TipoAbertura): EstiloDef[] => (tipo === "puerta" ? ESTILOS_PUERTA : ESTILOS_VENTANA);

export const ESTILO_DEFECTO: Record<TipoAbertura, EstiloAbertura> = { puerta: "interior", ventana: "corrediza" };

/** El estilo que vale para una abertura (las guardadas antes de que existieran estilos no traen ninguno). */
export function estiloDe(ab: { tipo: TipoAbertura; estilo?: string }): EstiloAbertura {
  const lista = estilosDe(ab.tipo);
  return (lista.find((e) => e.id === ab.estilo)?.id ?? ESTILO_DEFECTO[ab.tipo]) as EstiloAbertura;
}

/** Medidas de partida de un estilo. */
export function medidasDeEstilo(tipo: TipoAbertura, estilo: string | undefined): EstiloDef {
  const lista = estilosDe(tipo);
  return lista.find((e) => e.id === estilo) ?? lista[0];
}

/** ¿Es un estilo con ancho de dos hojas / paños (para dibujarlo)? */
export const esValidoEstilo = (tipo: TipoAbertura, estilo: string | undefined | null): estilo is EstiloAbertura => !!estilo && estilosDe(tipo).some((e) => e.id === estilo);
