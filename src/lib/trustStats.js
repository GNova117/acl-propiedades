// Cifras de confianza del inicio ("N familias atendidas", "días promedio de
// venta") y la galería de vendidas recientes. computeSalesStats es el espejo
// en JS de la función SQL public_sales_stats() (schema.sql): el modo demo la
// usa sobre sus datos locales y las pruebas fijan las reglas de ambas.

// Con menos ventas que esto el contador luce más pobre que no tenerlo, así
// que el bloque simplemente no se muestra hasta que haya un historial.
export const MIN_SALES_FOR_TRUST = 3;
export const MAX_RECENT_SOLD = 3;

const DAY_MS = 86400000;

function dayNumber(iso) {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? NaN : Math.floor(time / DAY_MS);
}

export function computeSalesStats(ventas, properties, now = Date.now()) {
  const byId = new Map((properties || []).map((p) => [p.id, p]));
  const sales = (ventas || []).filter((v) => byId.has(v.property_id));
  const today = Math.floor(now / DAY_MS);

  // Días de venta: solo ventas con fecha posterior al alta. Las casas que ya
  // estaban vendidas antes de usar el sistema se registraron el mismo día y
  // meterlas como "0 días" falsearía el promedio.
  const spans = sales
    .map((v) => dayNumber(v.fecha_venta) - dayNumber(byId.get(v.property_id).created_at))
    .filter((days) => days > 0);

  const recent = sales
    .filter((v) => byId.get(v.property_id).active !== false)
    .sort((a, b) => String(b.fecha_venta).localeCompare(String(a.fecha_venta)))
    .slice(0, 6)
    .map((v) => v.property_id);

  return {
    total: sales.length,
    last_12_months: sales.filter((v) => today - dayNumber(v.fecha_venta) <= 365).length,
    avg_days_to_sell: spans.length ? Math.round(spans.reduce((sum, d) => sum + d, 0) / spans.length) : null,
    recent_property_ids: recent,
  };
}

// Arma lo que pinta el inicio a partir de lo que devuelve la base. `null`
// significa "no mostrar el bloque".
export function buildTrustSummary(stats, properties) {
  if (!stats || !(stats.total >= MIN_SALES_FOR_TRUST)) return null;
  const available = (properties || []).filter((p) => p.status === "disponible" && p.active !== false).length;
  const byId = new Map((properties || []).map((p) => [p.id, p]));
  const recentSold = (stats.recent_property_ids || [])
    .map((id) => byId.get(id))
    .filter((p) => p && p.status === "vendida")
    .slice(0, MAX_RECENT_SOLD);
  return {
    sold: stats.total,
    // Si todas son del último año, repetir la cifra no aporta nada.
    soldLastYear: stats.last_12_months > 0 && stats.last_12_months < stats.total ? stats.last_12_months : null,
    avgDays: stats.avg_days_to_sell > 0 ? stats.avg_days_to_sell : null,
    available: available > 0 ? available : null,
    recentSold,
  };
}
