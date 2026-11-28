// Estatus de una propiedad. «vendida» y «rentada» son estatus cerrados: ya no se ofrece, no se agenda visita y no cuenta como
// disponible. Solo «vendida» cuenta como venta (ventas, comisiones, «vendidas en N días»); una rentada no.
export const CLOSED_STATUSES = ["vendida", "rentada"];
export const isClosedStatus = (status) => CLOSED_STATUSES.includes(status);
