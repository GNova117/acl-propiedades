// Atajos de fecha y hora al agendar una cita: «Hoy», «Mañana» y el próximo sábado (cuando más se
// enseñan propiedades), y las horas de visita más comunes. Así, con la cita ya llena desde el
// prospecto, agendar son dos toques. Funciones puras.

import { addDaysISO } from "./prospects";

// Horas de visita más usadas (formato del campo hora: HH:MM).
export const QUICK_TIMES = ["10:00", "12:00", "16:00", "18:00"];

// El próximo sábado que quede al menos a 2 días (si hoy es jueves, el sábado de esta semana; si es
// viernes, el de la siguiente: mañana ya es sábado y saldría repetido con «Mañana»).
export function nextSaturday(now = new Date()) {
  for (let days = 2; days <= 8; days++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    if (date.getDay() === 6) return addDaysISO(days, now);
  }
  return addDaysISO(2, now);
}

// Los atajos de fecha: [{ key, iso }] para «today», «tomorrow» y «saturday».
export function quickDates(now = new Date()) {
  return [
    { key: "today", iso: addDaysISO(0, now) },
    { key: "tomorrow", iso: addDaysISO(1, now) },
    { key: "saturday", iso: nextSaturday(now) },
  ];
}
