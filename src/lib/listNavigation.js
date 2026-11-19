// «Volver a propiedades» desde una ficha: si la persona llegó desde un listado
// (propiedades, una zona, terrenos, naves) se regresa a ESE listado, con sus
// filtros, su página y su posición, en vez de a un listado vacío.
//
// PropertyCard manda la dirección de donde está en el estado del enlace
// (`state.from`); aquí se decide si sirve como destino de «Volver».

const LIST_PATH = /^\/(propiedades(\/zona\/[^/?#]+)?|terrenos|naves-industriales)\/?(\?[^#]*)?$/;

export function listingFrom(state) {
  const from = state && typeof state === "object" ? state.from : null;
  return typeof from === "string" && LIST_PATH.test(from) ? from : null;
}
