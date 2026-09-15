// Convierte "" o null/undefined a null y cualquier otro valor a Number —
// usado por ambos backends para los campos numéricos opcionales de
// propiedades (bedrooms, altura_libre, mantenimiento_pct, etc.), que llegan
// del formulario como string vacío cuando no se capturan.
export function numOrNull(value) {
  return value === "" || value == null ? null : Number(value);
}

// El admin captura WhatsApp como texto libre ("+52 871 487 1494" es lo
// natural al escribir un número, aunque el formulario pida "521XXXXXXXXXX")
// pero wa.me solo acepta dígitos — un "+" o espacio en medio del número
// genera un enlace que no abre el chat. Se aplica tanto al guardar como al
// construir el enlace, para que un dato ya guardado mal también se autocorrija.
export function whatsappDigits(value) {
  return (value || "").replace(/\D/g, "");
}

// Un documento de cliente capturado por cámara siempre es jpeg; uno
// subido directo puede ser un PDF (contrato, cédula fiscal, etc. que ya
// existen como archivo). En modo demo file_path/signed_url es la propia
// data URL (empieza con "data:application/pdf"); contra Supabase real
// file_path es la ruta del archivo en el bucket (termina en ".pdf") — cubre
// las dos. Se revisa file_path antes que signed_url a propósito: la URL
// firmada real de Supabase trae un "?token=..." al final, así que nunca
// termina en ".pdf" aunque el archivo sí lo sea.
export function isPdfDoc(doc) {
  const src = doc.file_path || doc.signed_url || "";
  return src.startsWith("data:application/pdf") || src.toLowerCase().endsWith(".pdf");
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

// Nota: "cedula_fiscal" es el documento del RFC (la cédula de identificación
// fiscal) — se etiqueta como "RFC" en la interfaz, no se creó un tipo
// "rfc" aparte para no partir en dos los documentos ya capturados.
export const DOC_TYPES = [
  "solicitud_avaluo",
  "ine",
  "curp",
  "cedula_fiscal",
  "acta_nacimiento",
  "escrituras",
  "predial",
  "agua",
  "luz",
  "pago_avaluo",
  "contrato",
  "carta_deslindamiento",
  "aviso_privacidad",
  "carta_derechos",
];

// Qué documentos se capturan según el tipo de cliente: a un comprador no le
// aplican escrituras/predial/agua/luz (son del inmueble que vende el
// vendedor) y a un vendedor no le aplica la solicitud/pago de avalúo. Un
// cliente "ambos" ve todo. El orden es el mismo del expediente para avalúos
// (ver lib/expedienteAvaluoPdf.js) para que la pantalla de captura y el PDF
// se lean igual.
const DOC_TYPES_SHARED_TAIL = ["contrato", "carta_deslindamiento", "aviso_privacidad", "carta_derechos"];

export const DOC_TYPES_BY_CLIENT_TYPE = {
  comprador: ["solicitud_avaluo", "ine", "acta_nacimiento", "cedula_fiscal", "curp", "pago_avaluo", ...DOC_TYPES_SHARED_TAIL],
  vendedor: [
    "escrituras",
    "predial",
    "agua",
    "luz",
    "ine",
    "acta_nacimiento",
    "cedula_fiscal",
    "curp",
    ...DOC_TYPES_SHARED_TAIL,
  ],
};

export function docTypesForClientType(clientType) {
  return DOC_TYPES_BY_CLIENT_TYPE[clientType] || DOC_TYPES;
}

export const DOC_TYPE_ASPECT = {
  ine: 1.59,
  curp: 0.77,
  cedula_fiscal: 0.77,
  acta_nacimiento: 0.77,
  solicitud_avaluo: 0.77,
  escrituras: 0.77,
  predial: 0.77,
  agua: 0.77,
  luz: 0.77,
  pago_avaluo: 0.77,
  contrato: 0.77,
  carta_deslindamiento: 0.77,
  aviso_privacidad: 0.77,
  carta_derechos: 0.77,
};
