// 500: reglas de negocio que antes estaban copiadas en el modo demo (localBackend) y en el de Supabase (supabaseBackend).
// Aquí vive UNA versión de cada una: los dos backends solo hacen el acceso a datos (guardar, leer, subir archivos).
// Todo son funciones puras: convierten lo que manda el formulario en lo que se guarda, o deciden un cambio de estatus.
import { numOrNull } from "./format";
import { COMMISSION_CONCEPTS } from "./commissions";
import { CLIENT_EXPEDIENTE_KEYS } from "./clientExpedienteFields";

const text = (value) => value || null;
const trimmed = (value) => value?.trim() || null;
// Los campos numéricos opcionales del formulario llegan como "" cuando se dejan vacíos.
const optionalNumber = (value) => (value === "" ? null : Number(value));

// ── Propiedades ──────────────────────────────────────────────────────────────────────────────────────────────────
// Los campos que se guardan igual al crear y al editar. `media`: { images, videos, tour_360_images } ya resueltas por cada backend
// (en demo son data URLs, en Supabase son rutas de Storage). `isNew`: al crear, estatus y «activa» tienen valor de partida;
// al editar se respeta lo que mande el formulario. Antes el modo demo olvidaba `location_approximate` al editar: por eso hay una sola.
export function propertyFields(data, media, { isNew = false } = {}) {
  const { images, videos, tour_360_images } = media;
  return {
    title: data.title,
    type: data.type,
    description: data.description,
    price: Number(data.price),
    area_m2: Number(data.area_m2),
    bedrooms: optionalNumber(data.bedrooms),
    bathrooms: optionalNumber(data.bathrooms),
    parking: optionalNumber(data.parking),
    zone: data.zone,
    address: data.address,
    lat: Number(data.lat),
    lng: Number(data.lng),
    location_approximate: data.location_approximate === true,
    status: isNew ? data.status || "disponible" : data.status,
    operation_type: data.operation_type || "compra",
    active: isNew ? data.active !== false : data.active,
    images,
    main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
    videos,
    tour_360_images,
    colindancias: text(data.colindancias),
    servicios: text(data.servicios),
    acabados: text(data.acabados),
    sistema_constructivo: text(data.sistema_constructivo),
    techumbre: text(data.techumbre),
    condicion_propiedad: text(data.condicion_propiedad),
    estatus_construccion: text(data.estatus_construccion),
    altura_libre: numOrNull(data.altura_libre),
    anio_construccion: numOrNull(data.anio_construccion),
    area_minima_divisible: numOrNull(data.area_minima_divisible),
    area_oficina: numOrNull(data.area_oficina),
    luz_natural_pct: numOrNull(data.luz_natural_pct),
    sistema_contra_incendios: text(data.sistema_contra_incendios),
    tipo_seguridad: text(data.tipo_seguridad),
    andenes_carga: numOrNull(data.andenes_carga),
    rampas_vehiculares: numOrNull(data.rampas_vehiculares),
    mantenimiento_pct: numOrNull(data.mantenimiento_pct),
    tipo_nave: text(data.tipo_nave),
    amenities: data.amenities || [],
  };
}

// ── Apartados ────────────────────────────────────────────────────────────────────────────────────────────────────
// Al apartar una propiedad disponible pasa a «apartada»; al cancelar un apartado, si seguía apartada, vuelve a «disponible».
// → el estatus nuevo de la propiedad, o null si no cambia.
export const propertyStatusAfterHoldAdded = (propertyStatus) => (propertyStatus === "disponible" ? "apartada" : null);
export const propertyStatusAfterHoldChange = (holdStatus, propertyStatus) => (holdStatus === "cancelado" && propertyStatus === "apartada" ? "disponible" : null);

// ── Comisiones ───────────────────────────────────────────────────────────────────────────────────────────────────
// Lo que se acepta para guardar una comisión. Lanza "commission:invalid" (mismo código que entiende el panel).
export function commissionFields({ advisor_id, concept, amount } = {}) {
  if (!COMMISSION_CONCEPTS.includes(concept) || !advisor_id || !(Number(amount) >= 0)) throw new Error("commission:invalid");
  return { advisor_id, concept, amount: Math.round(Number(amount)) };
}

// ── Contenido del sitio ──────────────────────────────────────────────────────────────────────────────────────────
export const testimonialFields = (data) => ({
  name: data.name.trim(),
  role: trimmed(data.role),
  quote: data.quote.trim(),
  rating: Number(data.rating) || 5,
});

export const siteUpdateFields = (data) => ({ title: data.title.trim(), body: data.body.trim() });

// ── Zonas ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const zoneFields = (data) => ({
  name: data.name.trim(),
  price_per_m2: Number(data.price_per_m2) || 0,
  land_price_per_m2: Number(data.land_price_per_m2) || 0,
});

// Al fijar los precios de una zona: el de terreno solo cambia si viene en la llamada.
export function zonePriceFields(price_per_m2, land_price_per_m2) {
  const patch = { price_per_m2: Number(price_per_m2) };
  if (land_price_per_m2 !== undefined) patch.land_price_per_m2 = Number(land_price_per_m2) || 0;
  return patch;
}

// ── Catálogos de remodelación ────────────────────────────────────────────────────────────────────────────────────
export const materialFields = (data) => ({
  name: data.name,
  category: text(data.category),
  unit: text(data.unit),
  unit_price_internal: optionalNumber(data.unit_price_internal),
  unit_price_external: optionalNumber(data.unit_price_external),
  consumption_rate: data.consumption_rate == null ? null : optionalNumber(data.consumption_rate),
  consumption_basis: text(data.consumption_basis),
  active: data.active !== false,
});

export const laborFields = (data) => ({
  concepto: data.concepto.trim(),
  unidad: trimmed(data.unidad),
  precio_unitario: optionalNumber(data.precio_unitario),
});

// ── Expediente del cliente ───────────────────────────────────────────────────────────────────────────────────────
// NSS, contraseña del portal, número de crédito y las 2 referencias se guardan igual al crear y al editar.
export const clientExpedientePayload = (data) => Object.fromEntries(CLIENT_EXPEDIENTE_KEYS.map((key) => [key, data[key] || null]));
