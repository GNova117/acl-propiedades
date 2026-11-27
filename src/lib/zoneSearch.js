// 322: texto para buscar una zona sin importar mayúsculas ni acentos («la rosita» encuentra «La Rosita», «Cañada» con «canada»).
export function normalizeZoneText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Las zonas que coinciden con lo escrito: primero las que EMPIEZAN con el texto y luego las que lo contienen; sin texto,
// todas en su orden. `limit` evita una lista enorme en teléfono.
export function filterZones(zones, query, limit = 50) {
  const q = normalizeZoneText(query);
  const list = (zones || []).filter((z) => z && z.name);
  if (!q) return list.slice(0, limit);
  const starts = [];
  const contains = [];
  for (const zone of list) {
    const name = normalizeZoneText(zone.name);
    if (name.startsWith(q)) starts.push(zone);
    else if (name.includes(q)) contains.push(zone);
  }
  return [...starts, ...contains].slice(0, limit);
}
