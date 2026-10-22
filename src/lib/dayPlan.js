// "Mi día": lo de hoy del asesor en el orden en que conviene atenderlo. Junta las
// citas de la Agenda (en su hora) y los prospectos que piden contacto: primero
// los que llegaron solos y nadie ha atendido, luego los seguimientos vencidos
// (el más viejo primero) y al final los de hoy. Un prospecto sale una sola vez,
// en el grupo más urgente que le toque. Funciones puras; las pantallas solo
// pintan el resultado (los datos ya vienen filtrados por RLS: un asesor recibe
// solo lo suyo y la oficina todo).

import { DEFAULT_DURATION_MINUTES } from "./calendarEvent";
import { daysSince, followUpState, unattendedState } from "./prospects";

const minutesOfDay = (hora) => {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + (m || 0);
};

const dateISO = (date) => date.toLocaleDateString("en-CA");

// Citas de hoy: con hora primero (por hora) y las de todo el día al final.
// `state`: "past" (ya terminó), "now" (en curso), "next" (la próxima, con
// `minutesUntil`), "later" (más tarde) o "allDay" (sin hora).
export function todayAgenda(citas, now = new Date()) {
  const today = dateISO(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todays = citas.filter((c) => c.fecha === today);
  const timed = todays.filter((c) => c.hora).sort((a, b) => minutesOfDay(a.hora) - minutesOfDay(b.hora));
  const untimed = todays.filter((c) => !c.hora);

  let nextAssigned = false;
  const items = timed.map((cita) => {
    const start = minutesOfDay(cita.hora);
    if (start + DEFAULT_DURATION_MINUTES <= nowMin) return { cita, state: "past" };
    if (start <= nowMin) return { cita, state: "now" };
    if (!nextAssigned) {
      nextAssigned = true;
      return { cita, state: "next", minutesUntil: start - nowMin };
    }
    return { cita, state: "later" };
  });
  return [...items, ...untimed.map((cita) => ({ cita, state: "allDay" }))];
}

// Prospectos que piden contacto hoy, en tres grupos sin repetirse:
//   urgent  — entrante sin atender (los "late" primero, luego los más viejos)
//   overdue — seguimiento vencido (`daysLate`; el más atrasado primero)
//   today   — seguimiento programado para hoy
export function prospectsToContact(prospects, now = new Date()) {
  const urgent = [];
  const overdue = [];
  const today = [];
  for (const prospect of prospects) {
    const unattended = unattendedState(prospect, now);
    if (unattended) {
      urgent.push({ prospect, hours: unattended.hours, level: unattended.level });
      continue;
    }
    const follow = followUpState(prospect);
    if (follow === "overdue") overdue.push({ prospect, daysLate: daysSince(`${prospect.next_followup_at}T00:00:00`) ?? 0 });
    else if (follow === "today") today.push({ prospect });
  }
  urgent.sort((a, b) => (a.level === b.level ? b.hours - a.hours : a.level === "late" ? -1 : 1));
  overdue.sort((a, b) => b.daysLate - a.daysLate);
  return { urgent, overdue, today };
}

export function buildDayPlan({ citas = [], prospects = [], now = new Date() } = {}) {
  const agenda = todayAgenda(citas, now);
  const contact = prospectsToContact(prospects, now);
  const pendingAgenda = agenda.filter((i) => i.state !== "past").length;
  const toContact = contact.urgent.length + contact.overdue.length + contact.today.length;
  return { agenda, ...contact, pendingAgenda, toContact, isEmpty: agenda.length === 0 && toContact === 0 };
}
