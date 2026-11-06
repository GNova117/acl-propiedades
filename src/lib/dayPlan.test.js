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

describe("todayAgenda con estatus y duración", () => {
  it("no muestra las canceladas", () => {
    const items = todayAgenda([cita("ok", "15:00"), { ...cita("no", "16:00"), status: "cancelada" }], now);
    expect(items.map((i) => i.cita.id)).toEqual(["ok"]);
  });

  it("una cita marcada como realizada o 'no asistió' cuenta como terminada aunque aún no pase su hora", () => {
    const items = todayAgenda([{ ...cita("hecha", "15:00"), status: "realizada" }, { ...cita("falto", "16:00"), status: "no_asistio" }, cita("pendiente", "17:00")], now);
    expect(items.map((i) => i.state)).toEqual(["past", "past", "next"]);
  });

  it("usa la duración de la cita: una de 2 h que empezó hace 90 min sigue en curso", () => {
    expect(todayAgenda([{ ...cita("larga", "10:30"), duracion_min: 120 }], now)[0].state).toBe("now");
    expect(todayAgenda([cita("normal", "10:30")], now)[0].state).toBe("past"); // una hora por omisión
  });
});

describe("buildDayPlan: visitas por confirmar", () => {
  const web = { id: "w", titulo: "Visita: Casa", source: "sitio", status: "confirmada", fecha: addDaysISO(1), hora: "10:00", client_confirmed_at: null };

  it("trae las reservas del sitio sin confirmar y el día deja de estar libre", () => {
    const plan = buildDayPlan({ citas: [web], prospects: [], now });
    expect(plan.toConfirm.map((c) => c.id)).toEqual(["w"]);
    expect(plan.isEmpty).toBe(false);
  });

  it("sin nada pendiente el día sigue libre", () => {
    expect(buildDayPlan({ citas: [{ ...web, client_confirmed_at: "2026-11-01T10:00:00Z" }], prospects: [], now }).isEmpty).toBe(true);
  });
});

describe("buildDayPlan: visitas por cerrar", () => {
  const visita = { id: "v", titulo: "Visita: Casa", property_id: "p1", status: "confirmada", fecha: addDaysISO(-2), hora: "10:00" };

  it("trae las visitas de días anteriores que nadie cerró y el día deja de estar libre", () => {
    const plan = buildDayPlan({ citas: [visita], prospects: [], now });
    expect(plan.toClose.map((c) => c.id)).toEqual(["v"]);
    expect(plan.isEmpty).toBe(false);
  });

  it("una visita ya cerrada, cancelada o sin propiedad no estorba", () => {
    const plan = buildDayPlan({ citas: [{ ...visita, status: "realizada" }, { ...visita, id: "x", status: "cancelada" }, { ...visita, id: "y", property_id: null }], prospects: [], now });
    expect(plan.toClose).toEqual([]);
    expect(plan.isEmpty).toBe(true);
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

describe("Mi día: solicitudes de visita sin asesor", () => {
  const request = (id, fecha = today, hora = "16:00") => ({ id, titulo: `Visita ${id}`, fecha, hora, status: "solicitada", source: "sitio", advisor_id: null });

  it("salen en su propia lista (de todos) y no cuentan como cita de hoy", () => {
    const plan = buildDayPlan({ citas: [request("a", addDaysISO(1, now)), request("b")], now });
    expect(plan.requests.map((c) => c.id)).toEqual(["b", "a"]);
    expect(plan.agenda).toEqual([]);
    expect(plan.pendingAgenda).toBe(0);
    expect(plan.isEmpty).toBe(false);
  });

  it("sin solicitudes ni nada más el día está libre", () => {
    expect(buildDayPlan({ citas: [], now }).requests).toEqual([]);
    expect(buildDayPlan({ citas: [], now }).isEmpty).toBe(true);
  });
});
