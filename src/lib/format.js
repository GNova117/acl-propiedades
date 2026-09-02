export function formatMXN(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(number);
}

export function formatArea(value) {
  const number = Number(value) || 0;
  return `${new Intl.NumberFormat("es-MX").format(number)} m²`;
}

export const PROPERTY_TYPES = ["casa", "departamento", "nave_industrial"];

export const CLIENT_TYPES = ["comprador", "vendedor", "ambos"];

export const DOC_TYPES = ["ine", "curp", "cedula_fiscal", "acta_nacimiento", "pago_avaluo"];

export const DOC_TYPE_ASPECT = {
  ine: 1.59,
  curp: 0.77,
  cedula_fiscal: 0.77,
  acta_nacimiento: 0.77,
  pago_avaluo: 0.77,
};
