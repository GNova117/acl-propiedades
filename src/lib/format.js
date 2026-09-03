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

export const PROPERTY_TYPES = ["casa", "departamento", "nave_industrial", "terreno"];

// Casas y departamentos comparten el listado general "/propiedades"; naves
// industriales y terrenos tienen su propio apartado del sitio (menú, ruta y
// filtros independientes) — ver App.jsx / Header.jsx.
export const RESIDENTIAL_TYPES = ["casa", "departamento"];

export const PROPERTY_OPERATIONS = ["venta", "compra"];

// A qué listado del sitio pertenece cada tipo de propiedad. Única fuente de
// verdad para esta relación tipo → sección (CategoryCard y SearchBar la
// usan para no duplicar la tabla).
export function propertyListPath(type) {
  if (type === "nave_industrial") return "/naves-industriales";
  if (type === "terreno") return "/terrenos";
  return "/propiedades";
}

export const CLIENT_TYPES = ["comprador", "vendedor", "ambos"];

export const DOC_TYPES = ["ine", "curp", "cedula_fiscal", "acta_nacimiento", "pago_avaluo", "contrato"];

export const DOC_TYPE_ASPECT = {
  ine: 1.59,
  curp: 0.77,
  cedula_fiscal: 0.77,
  acta_nacimiento: 0.77,
  pago_avaluo: 0.77,
  contrato: 0.77,
};
