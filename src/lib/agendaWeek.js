// Vistas de semana y de día de la Agenda: qué días muestra y dónde cae cada cita en una cuadrícula por horas.
// Funciones puras (la pantalla solo pinta lo que devuelven). Las fechas van como "YYYY-MM-DD".

const DAY_MS = 86400000;
export const DEFAULT_START_HOUR = 8;
export const DEFAULT_END_HOUR = 20;
export const DEFAULT_DURATION = 60;

const dayNumber = (iso) => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS);
const fromDayNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export const shiftIso = (iso, days) => fromDayNumber(dayNumber(iso) + days);

// Los 7 días (lunes a domingo) de la semana que contiene `iso`.
export function weekDays(iso) {
  const n = dayNumber(iso);
  const weekdayMondayFirst = (new Date(n * DAY_MS).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => fromDayNumber(n - weekdayMondayFirst + i));
}

export const minutesOf = (hora) => {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + (m || 0);
};

// Horas que se dibujan: 8:00–20:00 por defecto, ampliadas para que quepa cualquier cita (y siempre horas completas).
export function hourRange(citas) {
  let start = DEFAULT_START_HOUR;
  let end = DEFAULT_END_HOUR;
  for (const c of citas) {
    if (!c.hora) continue;
    const s = minutesOf(c.hora);
    const e = s + (Number(c.duracion_min) > 0 ? Number(c.duracion_min) : DEFAULT_DURATION);
    start = Math.min(start, Math.floor(s / 60));
    end = Math.max(end, Math.ceil(e / 60));
  }
  return { start: Math.max(0, start), end: Math.min(24, end) };
}

// Citas con hora de un día, con su lugar en la cuadrícula: citas que se traslapan quedan lado a lado
// (`column` de `columns`). Las de todo el día (sin hora) salen aparte.
export function layoutDay(citas) {
  const timed = citas
    .filter((c) => c.hora)
    .map((cita) => {
      const startMin = minutesOf(cita.hora);
      return { cita, startMin, endMin: startMin + (Number(cita.duracion_min) > 0 ? Number(cita.duracion_min) : DEFAULT_DURATION) };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Se agrupan en «racimos» de citas encadenadas por traslapes; dentro de cada racimo se reparten columnas.
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds = [];
    for (const item of cluster) {
      let col = columnEnds.findIndex((end) => end <= item.startMin);
      if (col === -1) col = columnEnds.length;
      columnEnds[col] = item.endMin;
      item.column = col;
    }
    for (const item of cluster) placed.push({ ...item, columns: columnEnds.length });
    cluster = [];
  };
  for (const item of timed) {
    if (item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = cluster.length === 1 ? item.endMin : Math.max(clusterEnd, item.endMin);
  }
  flush();
  return { timed: placed, allDay: citas.filter((c) => !c.hora) };
}
