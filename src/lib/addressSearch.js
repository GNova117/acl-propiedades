// Búsqueda de dirección del formulario de propiedad: arma el texto que se manda al geocodificador y da formato a las coordenadas.
export function addressQuery(address, zone) {
  const a = String(address || "").trim();
  if (!a) return "";
  const z = String(zone || "").trim();
  // Si la dirección ya menciona la zona no se repite; el geocodificador rinde mejor con colonia + ciudad.
  const withZone = z && !a.toLowerCase().includes(z.toLowerCase()) ? `${a}, ${z}` : a;
  return withZone;
}

// 6 decimales (~10 cm) bastan; evita «25.54129999999999».
export function formatCoordinate(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : "";
}
