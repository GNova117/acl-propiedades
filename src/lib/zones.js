// Las zonas por colonia se nombran "<Ciudad> - <Colonia>" (ver migración de
// zonas en supabase/schema.sql), junto a las 3 zonas de ciudad "genéricas"
// que ya existían ("Torreón", "Gómez Palacio", "Lerdo"). Este helper agrupa
// ambas cosas para los <select> de zona, que de otra forma listarían
// cientos de colonias sin ningún orden.
export const LAGUNA_CITIES = ["Torreón", "Gómez Palacio", "Lerdo"];

export function cityOfZone(name) {
  return LAGUNA_CITIES.find((city) => name === city || name.startsWith(`${city} - `)) || null;
}

// Nombre corto para mostrar dentro de un <optgroup> de ciudad (quita el
// prefijo repetido; la zona de ciudad genérica se queda con su nombre tal cual).
export function zoneDisplayName(zone) {
  const city = cityOfZone(zone.name);
  if (!city || zone.name === city) return zone.name;
  return zone.name.slice(city.length + 3);
}

// Agrupa por ciudad en el mismo orden de LAGUNA_CITIES; las zonas que no
// siguen ese patrón (agregadas a mano) quedan en un grupo final sin ciudad.
export function groupZonesByCity(zones) {
  const byCity = new Map(LAGUNA_CITIES.map((city) => [city, []]));
  const other = [];
  for (const zone of zones) {
    const city = cityOfZone(zone.name);
    if (city) byCity.get(city).push(zone);
    else other.push(zone);
  }
  const groups = LAGUNA_CITIES.map((city) => ({ city, zones: byCity.get(city) })).filter((g) => g.zones.length > 0);
  if (other.length > 0) groups.push({ city: null, zones: other });
  return groups;
}
