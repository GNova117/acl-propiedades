// Chips de "filtros activos" arriba de los resultados del listado: uno por cada
// filtro puesto, con su ✕ para quitarlo solo. Función pura: recibe los textos
// ya traducidos y devuelve qué mostrar y qué cambiar al tocar el ✕.
import { formatCompactMXN } from "./priceRanges";

// `labels`: { t, typeLabel(key), zoneLabel?, amenityLabel(key) } — lo que
// depende del idioma o de catálogos vivos lo pone quien llama.
export function buildActiveFilterChips(filters, { t, typeLabel, amenityLabel, fixedType } = {}) {
  const chips = [];
  const add = (key, label, patch) => chips.push({ key, label, patch });

  if (filters.q?.trim()) add("q", t("activeFilters.search", { text: filters.q.trim() }), { q: "" });
  if (!fixedType && filters.type) add("type", typeLabel(filters.type), { type: "" });
  if (filters.operationType) add("operationType", t(`propertyOperation.${filters.operationType}`), { operationType: "" });
  if (filters.tipoNave) add("tipoNave", t(`naveTipo.${filters.tipoNave}`), { tipoNave: "" });
  if (filters.zone) add("zone", filters.zone, { zone: "" });

  const min = filters.minPrice ? Number(filters.minPrice) : null;
  const max = filters.maxPrice ? Number(filters.maxPrice) : null;
  if (min && max) add("price", t("activeFilters.priceBetween", { min: formatCompactMXN(min), max: formatCompactMXN(max) }), { minPrice: "", maxPrice: "" });
  else if (min) add("price", t("activeFilters.priceFrom", { min: formatCompactMXN(min) }), { minPrice: "", maxPrice: "" });
  else if (max) add("price", t("activeFilters.priceUpTo", { max: formatCompactMXN(max) }), { minPrice: "", maxPrice: "" });

  const minArea = filters.minArea ? Number(filters.minArea) : null;
  const maxArea = filters.maxArea ? Number(filters.maxArea) : null;
  if (minArea && maxArea) add("area", t("activeFilters.areaBetween", { min: minArea, max: maxArea }), { minArea: "", maxArea: "" });
  else if (minArea) add("area", t("activeFilters.areaFrom", { min: minArea }), { minArea: "", maxArea: "" });
  else if (maxArea) add("area", t("activeFilters.areaUpTo", { max: maxArea }), { minArea: "", maxArea: "" });

  if (filters.minBedrooms) add("minBedrooms", t("activeFilters.bedrooms", { count: filters.minBedrooms }), { minBedrooms: "" });
  if (filters.minBathrooms) add("minBathrooms", t("activeFilters.bathrooms", { count: filters.minBathrooms }), { minBathrooms: "" });
  if (filters.minParking) add("minParking", t("activeFilters.parking", { count: filters.minParking }), { minParking: "" });

  for (const key of filters.amenities || []) {
    add(`amenity:${key}`, amenityLabel(key), { amenities: (filters.amenities || []).filter((a) => a !== key) });
  }

  if (filters.bounds) add("bounds", t("activeFilters.mapArea"), { bounds: null });
  return chips;
}
