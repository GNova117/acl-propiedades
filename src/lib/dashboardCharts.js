// Series para las gráficas del Dashboard (embudo, ventas por mes, prospectos por fuente). Funciones puras: reciben las
// listas ya leídas y devuelven [{ key, value }] listas para dibujar. Los textos (nombres de etapa, de fuente, del mes)
// los pone la pantalla, que es la que traduce.

const STAGES = ["nuevo", "contactado", "interesado", "negociacion", "cerrado", "perdido"];
export const MAX_SOURCES = 7;

// Prospectos por etapa ACTUAL (una foto de hoy; el embudo con historial, que cuenta por dónde pasó cada uno, está en
// Estadísticas del embudo). `share`: qué parte del total es, en %.
export function stageSeries(prospects) {
  const total = prospects.length;
  return STAGES.map((key) => {
    const value = prospects.filter((p) => p.stage === key).length;
    return { key, value, share: total > 0 ? Math.round((value / total) * 100) : 0 };
  });
}

// Prospectos por fuente, de más a menos; las que sobran de `max` se juntan en «__rest» (la pantalla las llama «Otras»).
export function sourceSeries(prospects, max = MAX_SOURCES) {
  const counts = new Map();
  for (const p of prospects) {
    const key = p.source || "otro";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sorted = [...counts.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max - 1);
  return [...head, { key: "__rest", value: sorted.slice(max - 1).reduce((sum, s) => sum + s.value, 0) }];
}

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

// Ventas de los últimos `months` meses (el actual incluido), con ceros donde no hubo: [{ key: "2026-11", year, month, value }].
export function monthlySales(ventas, now = new Date(), months = 12) {
  const series = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    series.push({ key: monthKey(d), year: d.getFullYear(), month: d.getMonth(), value: 0 });
  }
  const byKey = new Map(series.map((s) => [s.key, s]));
  for (const v of ventas) {
    const entry = byKey.get(String(v.fecha_venta || "").slice(0, 7));
    if (entry) entry.value += 1;
  }
  return series;
}

// El valor más alto (para escalar las barras); nunca 0, así no se divide entre cero.
export const maxValue = (series) => Math.max(1, ...series.map((s) => s.value));
