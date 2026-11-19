import { describe, expect, it } from "vitest";
import { contactCounts, sequenceMessage, sequenceState, SEQUENCE_STEPS } from "./prospectSequence";

// Mediodía local del 17 de noviembre: las fechas se comparan por día, sin depender de la zona del equipo.
const NOW = new Date(2026, 10, 17, 12, 0, 0);
const created = (daysAgo) => new Date(2026, 10, 17 - daysAgo, 9, 0, 0).toISOString();
const prospect = (daysAgo, extra = {}) => ({ id: "p", stage: "nuevo", created_at: created(daysAgo), ...extra });

describe("sequenceState", () => {
  it("el primer contacto toca desde que llega", () => {
    expect(sequenceState(prospect(0), { contactCount: 0, now: NOW })).toMatchObject({ state: "due", index: 0, total: 4, step: { key: "first" }, daysLate: 0 });
  });

  it("después del primer contacto, el día 1 todavía no toca el mismo día y sí al siguiente", () => {
    expect(sequenceState(prospect(0), { contactCount: 1, now: NOW })).toMatchObject({ state: "upcoming", step: { key: "day1" } });
    expect(sequenceState(prospect(1), { contactCount: 1, now: NOW })).toMatchObject({ state: "due", step: { key: "day1" }, daysLate: 0 });
  });

  it("avisa cuántos días de retraso lleva el paso", () => {
    // Llegó hace 5 días y solo se le ha contactado una vez: el día 1 se pasó hace 4 días.
    expect(sequenceState(prospect(5), { contactCount: 1, now: NOW })).toMatchObject({ state: "due", step: { key: "day1" }, daysLate: 4 });
  });

  it("cada contacto registrado avanza un paso: 2 → día 3, 3 → día 7", () => {
    expect(sequenceState(prospect(1), { contactCount: 2, now: NOW }).step.key).toBe("day3");
    expect(sequenceState(prospect(8), { contactCount: 3, now: NOW })).toMatchObject({ step: { key: "day7" }, state: "due", daysLate: 1 });
  });

  it("con los cuatro pasos hechos la secuencia termina", () => {
    expect(sequenceState(prospect(10), { contactCount: 4, now: NOW })).toMatchObject({ state: "finished", step: null });
    expect(sequenceState(prospect(10), { contactCount: 9, now: NOW }).state).toBe("finished");
  });

  it("se detiene cuando el prospecto avanza: interesado, negociación, cerrado y perdido ya no tienen secuencia", () => {
    for (const stage of ["interesado", "negociacion", "cerrado", "perdido"]) expect(sequenceState(prospect(3, { stage }), { contactCount: 1, now: NOW })).toBeNull();
    expect(sequenceState(prospect(3, { stage: "contactado" }), { contactCount: 1, now: NOW })).not.toBeNull();
  });

  it("tolera datos raros", () => {
    expect(sequenceState({ stage: "nuevo", created_at: "no es fecha" }, { now: NOW })).toBeNull();
    expect(sequenceState(prospect(0), { contactCount: -3, now: NOW }).index).toBe(0);
    expect(sequenceState(prospect(0), { contactCount: "x", now: NOW }).index).toBe(0);
  });

  it("son 4 pasos: contacto inicial y días 1, 3 y 7", () => {
    expect(SEQUENCE_STEPS.map((s) => s.day)).toEqual([0, 1, 3, 7]);
  });
});

describe("contactCounts / sequenceMessage", () => {
  it("cuenta contactos por prospecto", () => {
    const counts = contactCounts([{ prospecto_id: "a" }, { prospecto_id: "a" }, { prospecto_id: "b" }, {}, null]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(contactCounts(null).size).toBe(0);
  });

  it("arma el mensaje con el primer nombre, la propiedad y el asesor", () => {
    const t = (key, vars) => `${key}|${vars.name}|${vars.property}|${vars.advisor}`;
    expect(sequenceMessage(t, { key: "day3" }, { name: "Luis Pérez Gómez", propertyTitle: "Casa en Lerdo", advisorName: "Ana" })).toBe("sequence.messages.day3|Luis|Casa en Lerdo|Ana");
  });
});
