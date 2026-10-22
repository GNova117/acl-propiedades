import { describe, expect, it } from "vitest";
import { buildDayPlan, prospectsToContact, todayAgenda } from "./dayPlan";
import { addDaysISO } from "./prospects";

// Hoy a las 12:00 (hora local), construido con partes para no depender de la zona horaria.
const now = new Date();
now.setHours(12, 0, 0, 0);
const today = now.toLocaleDateString("en-CA");
const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString();

const cita = (id, hora, fecha = today) => ({ id, titulo: `Cita ${id}`, fecha, hora });

describe("todayAgenda", () => {
  it("deja solo las de hoy, con hora primero (ordenadas) y las de todo el día al final", () => {
    const items = todayAgenda([cita("c", "16:00"), cita("sin", null), cita("a", "09:00"), cita("ayer", "10:00", addDaysISO(-1))], now);
    expect(items.map((i) => i.cita.id)).toEqual(["a", "c", "sin"]);
    expect(items[2].state).toBe("allDay");
  });

  it("marca la que ya terminó, la que está en curso, la próxima (con minutos) y las siguientes", () => {
    const items = todayAgenda([cita("p", "09:00"), cita("n", "11:30"), cita("x", "12:45:00"), cita("l", "17:00")], now);
    expect(items.map((i) => i.state)).toEqual(["past", "now", "next", "later"]);
    expect(items[2].minutesUntil).toBe(45);
  });

  it("acepta la hora con segundos (HH:MM:SS), como la devuelve la base", () => {
    expect(todayAgenda([cita("x", "13:00:00")], now)[0]).toMatchObject({ state: "next", minutesUntil: 60 });
  });
});

describe("prospectsToContact", () => {
  const base = { stage: "contactado", next_followup_at: null, last_contact_at: hoursAgo(30), created_at: hoursAgo(100) };
  const unattended = (id, hours) => ({ id, name: id, stage: "nuevo", source: "sitio", last_contact_at: null, next_followup_at: null, created_at: hoursAgo(hours) });

  it("agrupa en sin atender, vencidos y de hoy, el más urgente primero", () => {
    const { urgent, overdue, today: dueToday } = prospectsToContact(
      [
        unattended("u2h", 2),
        unattended("u9h", 9),
        { ...base, id: "v1", next_followup_at: addDaysISO(-1) },
        { ...base, id: "v5", next_followup_at: addDaysISO(-5) },
        { ...base, id: "hoy", next_followup_at: addDaysISO(0) },
        { ...base, id: "futuro", next_followup_at: addDaysISO(3) },
      ],
      now
    );
    expect(urgent.map((i) => i.prospect.id)).toEqual(["u9h", "u2h"]);
    expect(urgent[0].level).toBe("late");
    expect(overdue.map((i) => i.prospect.id)).toEqual(["v5", "v1"]);
    expect(overdue[0].daysLate).toBe(5);
    expect(dueToday.map((i) => i.prospect.id)).toEqual(["hoy"]);
  });

  it("un prospecto sin atender que además tiene seguimiento vencido sale una sola vez, como urgente", () => {
    const p = { ...unattended("dos", 6), next_followup_at: addDaysISO(-2) };
    const { urgent, overdue } = prospectsToContact([p], now);
    expect(urgent).toHaveLength(1);
    expect(overdue).toHaveLength(0);
  });

  it("ignora los cerrados y perdidos aunque tengan fecha", () => {
    const { overdue, today: dueToday } = prospectsToContact([{ ...base, id: "c", stage: "cerrado", next_followup_at: addDaysISO(-3) }, { ...base, id: "p", stage: "perdido", next_followup_at: addDaysISO(0) }], now);
    expect(overdue).toHaveLength(0);
    expect(dueToday).toHaveLength(0);
  });
});

describe("buildDayPlan", () => {
  it("cuenta lo pendiente (sin las citas que ya pasaron) y detecta un día libre", () => {
    expect(buildDayPlan({ now }).isEmpty).toBe(true);
    const plan = buildDayPlan({ citas: [cita("p", "09:00"), cita("n", "15:00")], prospects: [{ id: "x", name: "X", stage: "nuevo", source: "sitio", created_at: hoursAgo(3), last_contact_at: null }], now });
    expect(plan.pendingAgenda).toBe(1);
    expect(plan.toContact).toBe(1);
    expect(plan.isEmpty).toBe(false);
  });
});
