// 331: cuántos registros nuevos hubo este mes y cuántos el mes pasado, para que una cifra del inicio del panel no sea solo un total.
// Usa `created_at`; los registros sin fecha válida no cuentan. El mes se toma en hora local (el mes que ve quien usa el panel).
const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();

export function monthTrend(items, now = new Date()) {
  const current = monthIndex(now);
  let thisMonth = 0;
  let lastMonth = 0;
  let dated = 0;
  for (const item of items || []) {
    const when = item?.created_at ? new Date(item.created_at) : null;
    if (!when || Number.isNaN(when.getTime())) continue;
    dated += 1;
    const index = monthIndex(when);
    if (index === current) thisMonth += 1;
    else if (index === current - 1) lastMonth += 1;
  }
  return { thisMonth, lastMonth, dated };
}
