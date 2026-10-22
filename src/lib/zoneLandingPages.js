// Ciudades con página de aterrizaje propia ("/propiedades/zona/:zoneSlug").
// Son las 3 ciudades que ya se mencionan en el resto del sitio (p. ej.
// OFFICE_INFO.zones en chatbot.js) — no viene de la tabla admin-managed de
// zonas/colonias, que es mucho más granular.
export const ZONE_LANDING_CITIES = ["Torreón", "Gómez Palacio", "Lerdo"];

export function slugify(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findCityBySlug(slug) {
  return ZONE_LANDING_CITIES.find((city) => slugify(city) === slug) || null;
}

// property.zone se captura desde /admin/zonas, donde cada zona es "Ciudad"
// (p. ej. "Torreón") o "Ciudad - Colonia" (p. ej. "Torreón - Las Villas") —
// siempre con la ciudad como lo primero. No se usa property.address: es
// texto libre y puede mencionar otra ciudad de pasada (p. ej. una propiedad
// en Lerdo con dirección "Carretera Lerdo-Torreón" no está en Torreón).
export function propertyMatchesCity(property, city) {
  if (!property || !city) return false;
  const zone = (property.zone || "").trim().toLowerCase();
  if (!zone) return false;
  const normalizedCity = city.trim().toLowerCase();
  return zone === normalizedCity || zone.startsWith(`${normalizedCity} - `);
}
