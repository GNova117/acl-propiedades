// «Ficha completa»: qué tan lista está una propiedad para publicarse bien, y qué le falta. Es una guía para el asesor
// (las fichas con buenas fotos, descripción y datos reciben más contactos); no bloquea nada.
//
// Cada punto vale lo mismo que su peso; las fotos cuentan proporcional (3 de 5 fotos = 60 % de ese punto). Los puntos de
// datos propios del tipo (recámaras y baños para una casa, servicios para un terreno, altura y andenes para una nave)
// cambian según el tipo de propiedad.

export const MIN_PHOTOS = 5;
export const MIN_DESCRIPTION = 120;
export const COMPLETE_FROM = 80; // % a partir del cual la ficha se considera completa

const filled = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const validCoords = (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && !(Number(p.lat) === 0 && Number(p.lng) === 0);

// Los datos propios de cada tipo: [campo, ...] y cuántos de ellos hacen falta.
const SPECS_BY_TYPE = {
  casa: { fields: ["bedrooms", "bathrooms", "parking"], need: 3 },
  departamento: { fields: ["bedrooms", "bathrooms", "parking"], need: 3 },
  terreno: { fields: ["servicios", "colindancias"], need: 1 },
  nave_industrial: { fields: ["altura_libre", "andenes_carga", "area_oficina", "tipo_seguridad"], need: 2 },
};
const isHome = (p) => p.type === "casa" || p.type === "departamento";

/**
 * → { percent: 0-100, complete, items: [{ key, ok, weight, progress (0-1) }], missing: [key…] }
 * `missing`: las llaves de lo que falta o está a medias, de más a menos peso (i18n: completeness.items.<key>).
 */
export function propertyCompleteness(property = {}) {
  const photos = Array.isArray(property.images) ? property.images.filter(Boolean).length : 0;
  const specs = SPECS_BY_TYPE[property.type] || SPECS_BY_TYPE.casa;
  const specsFilled = specs.fields.filter((f) => filled(property[f])).length;
  const hasAdvisor = (property.advisor_ids?.length || property.advisors?.length || 0) > 0;
  const hasMedia = (property.videos?.length || 0) > 0 || (property.tour_360_images?.length || 0) > 0;

  const items = [
    { key: "photos", weight: 20, progress: Math.min(photos / MIN_PHOTOS, 1) },
    { key: "description", weight: 15, progress: Math.min(String(property.description || "").trim().length / MIN_DESCRIPTION, 1) },
    { key: "location", weight: 10, progress: (validCoords(property) ? 0.5 : 0) + (filled(property.address) ? 0.5 : 0) },
    { key: "basics", weight: 10, progress: (Number(property.price) > 0 ? 0.5 : 0) + (Number(property.area_m2) > 0 ? 0.5 : 0) },
    { key: "specs", weight: 15, progress: Math.min(specsFilled / specs.need, 1) },
    { key: "zone", weight: 5, progress: filled(property.zone) ? 1 : 0 },
    { key: "advisor", weight: 10, progress: hasAdvisor ? 1 : 0 },
    { key: "media", weight: 5, progress: hasMedia ? 1 : 0 },
    // Amenidades y plano solo aplican a viviendas.
    ...(isHome(property)
      ? [
          { key: "amenities", weight: 5, progress: (property.amenities?.length || 0) > 0 ? 1 : 0 },
          { key: "plan", weight: 5, progress: filled(property.floor_plan_url) ? 1 : 0 },
        ]
      : []),
  ].map((item) => ({ ...item, ok: item.progress >= 1 }));

  const total = items.reduce((sum, i) => sum + i.weight, 0);
  const earned = items.reduce((sum, i) => sum + i.weight * i.progress, 0);
  const percent = Math.round((earned / total) * 100);
  const missing = items
    .filter((i) => !i.ok)
    .sort((a, b) => b.weight * (1 - b.progress) - a.weight * (1 - a.progress))
    .map((i) => i.key);
  return { percent, complete: percent >= COMPLETE_FROM, items, missing };
}
