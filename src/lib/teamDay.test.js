import { describe, expect, it } from "vitest";
import { buildTeamDay } from "./teamDay";
import { FORGOTTEN_DAYS, addDaysISO, isForgotten, todayISO } from "./prospects";

const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

const ana = { id: "a1", name: "Ana", active: true };
const beto = { id: "a2", name: "Beto", active: true };
const carlos = { id: "a3", name: "Carlos", active: true };
const baja = { id: "a9", name: "Zoila (baja)", active: false };

const p = (id, over = {}) => ({ id, name: id, stage: "contactado", source: "manual", advisor_id: "a1", last_contact_at: daysAgo(1), next_followup_at: addDaysISO(3), created_at: daysAgo(20), ...over });
const cita = (id, over = {}) => ({ id, advisor_id: "a1", titulo: id, fecha: todayISO(), hora: "23:30", status: "confirmada", source: "admin", ...over });

describe("isForgotten", () => {
  it("abierto, sin seguimiento programado y sin contacto en 7 días o más", () => {
    expect(isForgotten(p("x", { next_followup_at: null, last_contact_at: daysAgo(FORGOTTEN_DAYS) }), now)).toBe(true);
    expect(isForgotten(p("x", { next_followup_at: null, last_contact_at: daysAgo(FORGOTTEN_DAYS - 1) }), now)).toBe(false);
  });
  it("con seguimiento programado (aunque esté vencido: eso ya tiene su aviso) no es olvidado", () => {
    expect(isForgotten(p("x", { next_followup_at: addDaysISO(5), last_contact_at: daysAgo(30) }), now)).toBe(false);
    expect(isForgotten(p("x", { next_followup_at: addDaysISO(-3), last_contact_at: daysAgo(30) }), now)).toBe(false);
  });
  it("sin contacto cuenta desde que se capturó", () => {
    expect(isForgotten(p("x", { next_followup_at: null, last_contact_at: null, created_at: daysAgo(10) }), now)).toBe(true);
    expect(isForgotten(p("x", { next_followup_at: null, last_contact_at: null, created_at: daysAgo(2) }), now)).toBe(false);
  });
  it("cerrados y perdidos no; un entrante sin atender tampoco (tiene su propio aviso)", () => {
    for (const stage of ["cerrado", "perdido"]) expect(isForgotten(p("x", { stage, next_followup_at: null, last_contact_at: daysAgo(30) }), now)).toBe(false);
    expect(isForgotten(p("x", { stage: "nuevo", source: "sitio", next_followup_at: null, last_contact_at: null, created_at: daysAgo(30) }), now)).toBe(false);
  });
  it("una fecha inválida no se cuenta", () => {
    expect(isForgotten(p("x", { next_followup_at: null, last_contact_at: null, created_at: "no es fecha" }), now)).toBe(false);
  });
});

describe("buildTeamDay", () => {
  it("cuenta por asesor lo que cada uno ve en Mi día y manda primero al que más atención pide", () => {
    const prospects = [
      // Ana: un entrante sin atender hace 6 h (late), un vencido, uno de hoy, uno olvidado y uno al día
      p("a-late", { stage: "nuevo", source: "sitio", last_contact_at: null, next_followup_at: null, created_at: hoursAgo(6) }),
      p("a-over", { next_followup_at: addDaysISO(-2) }),
      p("a-hoy", { next_followup_at: todayISO() }),
      p("a-olv", { next_followup_at: null, last_contact_at: daysAgo(12) }),
      p("a-ok"),
      p("a-cerrado", { stage: "cerrado", next_followup_at: addDaysISO(-9) }), // cerrado: no cuenta
      // Beto: solo uno al día
      p("b-ok", { advisor_id: "a2" }),
    ];
    const citas = [
      cita("c1"), // Ana, hoy 23:30: pendiente
      cita("c2", { fecha: addDaysISO(-2), hora: "10:00", property_id: "prop-1" }), // Ana: visita de hace 2 días sin cerrar
    ];
    const out = buildTeamDay({ prospects, citas, advisors: [beto, ana, carlos], now });
    expect(out.rows.map((r) => r.advisor.name)).toEqual(["Ana", "Beto", "Carlos"]);
    const [a, b, c] = out.rows;
    expect(a).toMatchObject({ open: 5, unattended: 1, late: 1, overdue: 1, dueToday: 1, forgotten: 1, agendaToday: 1, toClose: 1, toConfirm: 0 });
    expect(a.attention).toBe(4 + 2 + 1 + 1); // late + vencido + olvidado + por cerrar
    expect(b).toMatchObject({ open: 1, unattended: 0, overdue: 0, attention: 0 });
    expect(c).toMatchObject({ open: 0, attention: 0 }); // sin nada: igual aparece (al día)
  });

  it("un entrante con menos de 4 h es «warn», no «late»; pesa menos", () => {
    const prospects = [p("w", { stage: "nuevo", source: "sitio", last_contact_at: null, next_followup_at: null, created_at: hoursAgo(2) })];
    const [row] = buildTeamDay({ prospects, advisors: [ana], now }).rows;
    expect(row).toMatchObject({ unattended: 1, late: 0, attention: 2 });
  });

  it("los asesores dados de baja no tienen renglón, y sus prospectos pasan a «sin asesor»", () => {
    const prospects = [p("huerfano", { advisor_id: "a9", next_followup_at: addDaysISO(-1) }), p("sin", { advisor_id: null, next_followup_at: addDaysISO(-4) }), p("ana-ok")];
    const out = buildTeamDay({ prospects, advisors: [ana, baja], now });
    expect(out.rows.map((r) => r.advisor.name)).toEqual(["Ana"]);
    expect(out.unassigned).toMatchObject({ open: 2, overdue: 2 });
    expect(out.rows[0].open).toBe(1);
  });

  it("solicitudes de visita sin tomar: las del sitio sin asesor; no cuentan en ningún asesor", () => {
    const citas = [
      cita("s1", { advisor_id: null, status: "solicitada", source: "sitio", fecha: addDaysISO(1) }),
      cita("s2", { advisor_id: null, status: "solicitada", source: "sitio", fecha: addDaysISO(2) }),
      cita("s3", { advisor_id: "a1", status: "solicitada", source: "sitio", fecha: addDaysISO(2) }), // ya tiene asesor
    ];
    const out = buildTeamDay({ citas, advisors: [ana], now });
    expect(out.requests).toBe(2);
    expect(out.rows[0].agendaToday).toBe(0);
  });

  it("totales: la suma de los asesores y lo que no tiene dueño", () => {
    const prospects = [p("1", { next_followup_at: addDaysISO(-1) }), p("2", { advisor_id: "a2", next_followup_at: addDaysISO(-1) }), p("3", { advisor_id: null, next_followup_at: addDaysISO(-1) })];
    const out = buildTeamDay({ prospects, advisors: [ana, beto], now });
    expect(out.totals).toMatchObject({ open: 3, overdue: 3, attention: 6 });
  });

  it("sin datos no truena", () => {
    const out = buildTeamDay();
    expect(out.rows).toEqual([]);
    expect(out.totals.attention).toBe(0);
    expect(out.requests).toBe(0);
  });

  it("los que empatan en atención se ordenan por nombre", () => {
    const out = buildTeamDay({ advisors: [carlos, ana, beto], now });
    expect(out.rows.map((r) => r.advisor.name)).toEqual(["Ana", "Beto", "Carlos"]);
  });
});
