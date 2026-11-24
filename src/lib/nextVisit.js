// «Visítala hoy / mañana / el sábado» en las tarjetas del listado: a partir del primer horario libre de
// cada propiedad (db.getNextVisitSlots) se decide qué etiqueta mostrar. Todo en hora de México.
import { addDays, mexicoParts, weekdayOf } from "./visitSlots";

// Hasta cuántos días adelante vale la pena anunciarlo: más allá ya no es «pronto».
export const NEXT_VISIT_MAX_DAYS = 3;

// { kind: "today" | "tomorrow" | "weekday", weekday } o null si no aplica (sin horario o muy lejano).
// `weekday`: 0 = domingo … 6 = sábado (solo en kind "weekday").
export function nextVisitTag(slot, now = new Date()) {
  const fecha = slot?.fecha;
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const today = mexicoParts(now).date;
  if (fecha === today) return { kind: "today" };
  if (fecha === addDays(today, 1)) return { kind: "tomorrow" };
  for (let days = 2; days <= NEXT_VISIT_MAX_DAYS; days += 1) {
    if (fecha === addDays(today, days)) return { kind: "weekday", weekday: weekdayOf(fecha) };
  }
  return null;
}

// Lista de la base → { [property_id]: slot }.
export function indexNextSlots(list) {
  const map = {};
  for (const slot of Array.isArray(list) ? list : []) {
    if (slot?.property_id && !map[slot.property_id]) map[slot.property_id] = slot;
  }
  return map;
}
