// Convierte "" o null/undefined a null y cualquier otro valor a Number —
// usado por ambos backends para los campos numéricos opcionales de
// propiedades (bedrooms, altura_libre, mantenimiento_pct, etc.), que llegan
// del formulario como string vacío cuando no se capturan.
export function numOrNull(value) {
  return value === "" || value == null ? null : Number(value);
}

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

// Tipos de propiedad: casa/departamento/nave_industrial/terreno vienen
// sembrados de fábrica, pero desde /admin/zonas (sección "Tipos de
// propiedad") se pueden agregar más — el catálogo real vive en la tabla
// property_types (db.getPropertyTypes()), no aquí. Estas dos siguen fijas
// en código porque tienen apartado propio del sitio (menú, ruta y filtros
// independientes) — cualquier tipo nuevo que se agregue cae por default en
// el listado general "/propiedades".
export const SPECIAL_SECTION_TYPES = { nave_industrial: "/naves-industriales", terreno: "/terrenos" };

export function propertyListPath(type) {
  return SPECIAL_SECTION_TYPES[type] || "/propiedades";
}

// Convierte el texto que escribe el admin en un tipo nuevo ("Bodega") a un
// identificador técnico estable ("bodega") — mismo tratamiento que se le
// da a cualquier slug en este proyecto (sin acentos, minúsculas, guión
// bajo). No se persiste el acento porque `type` funciona como llave para
// filtros/rutas, no como texto a mostrar.
export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Etiqueta a mostrar para un tipo de propiedad: usa la traducción i18n si
// existe (los 4 tipos de fábrica están traducidos ES/EN); si no — un tipo
// que el admin acaba de agregar — cae a una versión legible del slug en
// vez de mostrar la clave de traducción cruda ("propertyType.bodega").
export function propertyTypeLabel(t, type) {
  const key = `propertyType.${type}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return String(type)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const CLIENT_TYPES = ["comprador", "vendedor", "ambos"];

export const DOC_TYPES = [
  "ine",
  "curp",
  "cedula_fiscal",
  "acta_nacimiento",
  "pago_avaluo",
  "contrato",
  "carta_deslindamiento",
  "aviso_privacidad",
  "carta_derechos",
];

export const DOC_TYPE_ASPECT = {
  ine: 1.59,
  curp: 0.77,
  cedula_fiscal: 0.77,
  acta_nacimiento: 0.77,
  pago_avaluo: 0.77,
  contrato: 0.77,
  carta_deslindamiento: 0.77,
  aviso_privacidad: 0.77,
  carta_derechos: 0.77,
};
