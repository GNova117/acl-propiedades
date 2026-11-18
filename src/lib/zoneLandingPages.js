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

// ── Páginas por colonia ("/propiedades/zona/torreon/las-villas") ──

// "Torreón - Las Villas" → { city: "Torreón", colony: "Las Villas" }; la zona de ciudad sola ("Torreón") o una zona que
// no sigue el patrón → null (no tiene página de colonia).
export function splitColonyZone(zoneName) {
  const name = String(zoneName || "").trim();
  for (const city of ZONE_LANDING_CITIES) {
    const prefix = `${city} - `;
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      const colony = name.slice(prefix.length).trim();
      return colony ? { city, colony } : null;
    }
  }
  return null;
}

export function colonyPath(zoneName) {
  const parts = splitColonyZone(zoneName);
  if (!parts) return null;
  return `/propiedades/zona/${slugify(parts.city)}/${slugify(parts.colony)}`;
}

// Nombre de zona (como está en el catálogo de /admin/zonas) que corresponde a la ciudad y colonia de la dirección.
// `zoneNames`: nombres de zona del catálogo. null si no existe.
export function findColonyZone(zoneNames, citySlug, colonySlug) {
  if (!citySlug || !colonySlug) return null;
  return (
    (zoneNames || []).find((name) => {
      const parts = splitColonyZone(name);
      return parts && slugify(parts.city) === citySlug && slugify(parts.colony) === colonySlug;
    }) || null
  );
}

export function propertyMatchesZone(property, zoneName) {
  const zone = String(property?.zone || "").trim().toLowerCase();
  return Boolean(zone) && zone === String(zoneName || "").trim().toLowerCase();
}

// Colonias de una ciudad con propiedades disponibles, de la que más tiene a la que menos (y por nombre).
// → [{ zone, colony, count, path }]
export function coloniesWithListings(properties, city) {
  const counts = new Map();
  for (const property of properties || []) {
    if (property.status !== "disponible" || property.active === false || !propertyMatchesCity(property, city)) continue;
    const parts = splitColonyZone(property.zone);
    if (!parts) continue;
    const key = `${parts.city} - ${parts.colony}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([zone, count]) => ({ zone, colony: splitColonyZone(zone).colony, count, path: colonyPath(zone) }))
    .sort((a, b) => b.count - a.count || a.colony.localeCompare(b.colony, "es"));
}
