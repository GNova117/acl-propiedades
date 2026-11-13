// Comodidad en computadora para el tablero de Prospectos: arrastrar una tarjeta a otra columna (cambia de etapa) y la vista dividida
// (lista a la izquierda, ficha a la derecha). Funciones puras; AdminProspects solo conecta los eventos.

import { bulkFields } from "./prospectBulk";
import { PROSPECT_STAGES } from "./prospects";

// Soltar `prospect` sobre la columna `stage`: qué campos cambian y si conviene confirmar, o null si no hay nada que hacer (misma
// etapa, o una columna que no existe). Es el mismo cambio que el selector «Mover a…» de la tarjeta (al salir de «perdido» se limpia
// el motivo). Mandar a «perdido» pide confirmación: soltar sin querer no debería dar de baja a un prospecto.
export function dropAction(prospect, stage) {
  if (!prospect || !PROSPECT_STAGES.includes(stage)) return null;
  const fields = bulkFields("stage", stage, prospect);
  return fields ? { fields, confirm: stage === "perdido" } : null;
}

// Orden de la lista compacta de la vista dividida: por etapa, como el tablero de izquierda a derecha, y dentro de cada una por
// nombre. No muta la lista recibida.
export function splitOrder(prospects) {
  return [...prospects].sort(
    (a, b) => PROSPECT_STAGES.indexOf(a.stage) - PROSPECT_STAGES.indexOf(b.stage) || String(a.name || "").localeCompare(String(b.name || ""), "es")
  );
}

// El prospecto que muestra la ficha: el elegido si sigue en la lista (un filtro puede esconderlo); si no, el primero; sin lista, null.
export function resolveSelected(ordered, selectedId) {
  if (ordered.length === 0) return null;
  return ordered.find((p) => p.id === selectedId) || ordered[0];
}

// Al arrastrar una tarjeta cerca del borde del tablero (que se desliza de lado en pantallas donde no caben las seis columnas),
// cuánto correr el tablero en este instante: negativo hacia la izquierda, positivo hacia la derecha, 0 lejos de los bordes.
// `rect`: { left, right } del tablero en pantalla; `x`: la posición horizontal del puntero.
export function edgeScrollDelta(rect, x, { edge = 80, step = 24 } = {}) {
  if (x >= rect.right - edge) return step;
  if (x <= rect.left + edge) return -step;
  return 0;
}
