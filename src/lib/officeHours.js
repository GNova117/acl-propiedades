// Horario de la oficina (Torreón, hora del centro de México): lunes a viernes 8:00–14:00 y 16:00–18:00.
// «Abierto ahora» se calcula con la hora de Torreón aunque el visitante esté en otra zona.
export const OFFICE_TIMEZONE = "America/Monterrey";
export const OFFICE_SHIFTS = [
  [8 * 60, 14 * 60],
  [16 * 60, 18 * 60],
];

// → { weekday: 0-6 (0 = domingo), minutes: minutos desde la medianoche } en la zona de la oficina.
export function officeClock(date = new Date(), timeZone = OFFICE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
}

export function isOfficeOpen(date = new Date()) {
  const { weekday, minutes } = officeClock(date);
  if (weekday < 1 || weekday > 5) return false;
  return OFFICE_SHIFTS.some(([from, to]) => minutes >= from && minutes < to);
}
