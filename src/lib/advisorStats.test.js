import { describe, expect, it } from "vitest";
import { buildAdvisorStats } from "./advisorStats";

const NOW = new Date(2026, 10, 13, 12, 0, 0); // viernes 13 de noviembre de 2026, mediodía local
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
const dayISO = (n) => new Date(2026, 10, 13 + n).toLocaleDateString("en-CA");

const advisors = [{ id: "a1", name: "Ana" }, { id: "a2", name: "Beto", active: false }];
const prospect = (id, advisor_id, over = {}) => ({ id, advisor_id, stage: "contactado", source: "manual", created_at: hoursAgo(500), last_contact_at: hoursAgo(10), next_followup_at: dayISO(3), ...over });
const property = (id, advisorIds, over = {}) => ({ id, status: "disponible", active: true, advisors: advisorIds.map((x) => ({ id: x })), ...over });
const cita = (id, advisor_id, hora, over = {}) => ({ id, advisor_id, fecha: dayISO(0), hora, duracion_min: 60, status: "confirmada", ...over });

describe("buildAdvisorStats", () => {
  it("cuenta por asesor sus prospectos abiertos (no los cerrados ni los de otro) y las propiedades disponibles suyas", () => {
    const { rows } = buildAdvisorStats({
      advisors,
      prospects: [prospect("p1", "a1"), prospect("p2", "a1", { stage: "cerrado" }), prospect("p3", "a1", { stage: "perdido" }), prospect("p4", "a2"), prospect("p5", null)],
      properties: [property("h1", ["a1"]), property("h2", ["a1", "a2"]), property("h3", ["a1"], { status: "vendida" }), property("h4", ["a2"], { active: false })],
      now: NOW,
    });
    expect(rows[0]).toMatchObject({ openProspects: 1, properties: 2 });
    expect(rows[1]).toMatchObject({ openProspects: 1, properties: 1 });
  });

  it("separa lo que pide atención: entrantes sin atender (y los que ya van tarde) y seguimientos vencidos", () => {
    const sinAtender = (id, horas) => prospect(id, "a1", { stage: "nuevo", source: "sitio", last_contact_at: null, next_followup_at: null, created_at: hoursAgo(horas) });
    const { rows, totals } = buildAdvisorStats({
      advisors,
      prospects: [sinAtender("n1", 1), sinAtender("n2", 30), prospect("v1", "a1", { next_followup_at: dayISO(-2) }), prospect("ok", "a1")],
      now: NOW,
    });
    expect(rows[0]).toMatchObject({ openProspects: 4, unattended: 2, late: 1, overdue: 1, needsAttention: true });
    expect(rows[1]).toMatchObject({ openProspects: 0, unattended: 0, overdue: 0, needsAttention: false });
    expect(totals).toMatchObject({ openProspects: 4, unattended: 2, late: 1, overdue: 1 });
  });

  it("visitas del mes (no las de otro mes ni de otro asesor) y citas que le quedan hoy (no las ya terminadas)", () => {
    const { rows } = buildAdvisorStats({
      advisors,
      visits: [{ advisor_id: "a1", visited_at: dayISO(-5) }, { advisor_id: "a1", visited_at: "2026-10-30T10:00:00" }, { advisor_id: "a2", visited_at: dayISO(-1) }],
      citas: [cita("c1", "a1", "08:00"), cita("c2", "a1", "15:00"), cita("c3", "a1", "17:00", { status: "cancelada" }), cita("c4", "a2", "16:00")],
      now: NOW,
    });
    expect(rows[0]).toMatchObject({ visitsMonth: 1, agendaToday: 1 }); // la de las 8:00 ya pasó; la cancelada no cuenta
    expect(rows[1]).toMatchObject({ visitsMonth: 1, agendaToday: 1 });
  });

  it("marca hasta cuándo está ausente quien lo está hoy", () => {
    const { rows } = buildAdvisorStats({
      advisors,
      timeOff: [{ advisor_id: "a1", fecha_inicio: dayISO(-1), fecha_fin: dayISO(2) }, { advisor_id: "a2", fecha_inicio: dayISO(5), fecha_fin: dayISO(6) }],
      now: NOW,
    });
    expect(rows[0].absentUntil).toBe(dayISO(2));
    expect(rows[1].absentUntil).toBeNull();
  });

  it("sin datos todo es cero y no truena", () => {
    const { rows, totals } = buildAdvisorStats({ advisors, now: NOW });
    expect(rows.every((r) => r.openProspects === 0 && r.properties === 0 && !r.needsAttention)).toBe(true);
    expect(Object.values(totals).every((n) => n === 0)).toBe(true);
    expect(buildAdvisorStats()).toEqual({ rows: [], totals: expect.any(Object) });
  });
});
