// ¿Alguno de los filtros que viven dentro de «Más filtros» ya está aplicado? (superficie, recámaras, baños, estacionamientos, amenidades)
export function hasMoreFiltersApplied(filters) {
  return Boolean(filters?.minArea || filters?.maxArea || filters?.minBedrooms || filters?.minBathrooms || filters?.minParking || (filters?.amenities || []).length);
}
