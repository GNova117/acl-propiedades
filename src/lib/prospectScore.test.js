import { describe, expect, it } from "vitest";
import { HOT_FROM, WARM_FROM, prospectScore, sortByScore } from "./prospectScore";

const NOW = new Date();
const ago = (days) => new Date(NOW - days * 86400000).toISOString();
const base = (extra = {}) => ({ id: "p", stage: "nuevo", source: "manual", created_at: ago(1), last_contact_at: null, next_followup_at: null, property_id: null, search_criteria: null, ...extra });
const keys = (result) => result.reasons.map((r) => r.key);

describe("prospectScore", () => {
  it("cerrados y perdidos no se califican", () => {
    expect(prospectScore(base({ stage: "cerrado" }))).toBeNull();
    expect(prospectScore(base({ stage: "perdido" }))).toBeNull();
  });

  it("un prospecto nuevo sin datos es frío", () => {
    const r = prospectScore(base(), { now: NOW });
    expect(r.level).toBe("cold");
    expect(r.score).toBeLessThan(WARM_FROM);
  });

  it("negociación con propiedad y presupuesto es caliente", () => {
    const r = prospectScore(base({ stage: "negociacion", source: "visita_agendada", property_id: "x", search_criteria: { max_price: 2000000 }, last_contact_at: ago(1) }), { now: NOW });
    expect(r.level).toBe("hot");
    expect(r.score).toBeGreaterThanOrEqual(HOT_FROM);
    expect(keys(r)).toEqual(expect.arrayContaining(["stage_negociacion", "source_visita_agendada", "hasProperty", "hasBudget", "recentContact"]));
  });

  it("pedir una visita pesa más que escribir al chat o entrar al sitio", () => {
    const score = (source) => prospectScore(base({ source }), { now: NOW }).score;
    expect(score("visita_agendada")).toBeGreaterThan(score("simulador"));
    expect(score("simulador")).toBeGreaterThan(score("chatbot"));
    expect(score("chatbot")).toBeGreaterThan(score("sitio"));
    expect(score("sitio")).toBeGreaterThan(score("manual"));
  });

  it("abrir la selección hace poco y tener propiedades que encajan suman; una apertura vieja no", () => {
    const plain = prospectScore(base({ stage: "interesado" }), { now: NOW }).score;
    expect(prospectScore(base({ stage: "interesado" }), { now: NOW, selectionOpenedAt: ago(1) }).score).toBe(plain + 15);
    expect(prospectScore(base({ stage: "interesado" }), { now: NOW, selectionOpenedAt: ago(20) }).score).toBe(plain);
    expect(prospectScore(base({ stage: "interesado" }), { now: NOW, matchCount: 3 }).score).toBe(plain + 5);
  });

  it("el enfriamiento resta: sin contacto hace semanas y seguimiento vencido", () => {
    const fresh = prospectScore(base({ stage: "interesado", last_contact_at: ago(5) }), { now: NOW });
    const cold = prospectScore(base({ stage: "interesado", created_at: ago(40), last_contact_at: ago(20), next_followup_at: "2020-01-01" }), { now: NOW });
    expect(cold.score).toBe(fresh.score - 25);
    expect(keys(cold)).toEqual(expect.arrayContaining(["stale", "followOverdue"]));
  });

  it("el puntaje queda entre 0 y 100 y los niveles respetan los cortes", () => {
    const max = prospectScore(base({ stage: "negociacion", source: "visita_agendada", property_id: "x", search_criteria: { min_price: 1 }, last_contact_at: ago(0) }), { now: NOW, matchCount: 2, selectionOpenedAt: ago(0) });
    expect(max.score).toBeLessThanOrEqual(100);
    const min = prospectScore(base({ created_at: ago(90), next_followup_at: "2020-01-01" }), { now: NOW });
    expect(min.score).toBeGreaterThanOrEqual(0);
    expect(min.level).toBe("cold");
  });
});

describe("sortByScore", () => {
  it("de más caliente a más frío; los no calificados al final; empate por el más reciente", () => {
    const hot = base({ id: "hot", stage: "negociacion", property_id: "x" });
    const cold = base({ id: "cold" });
    const closed = base({ id: "closed", stage: "cerrado" });
    const newerCold = base({ id: "newer", created_at: ago(0) });
    const scoreOf = (p) => prospectScore(p, { now: NOW });
    expect(sortByScore([closed, cold, newerCold, hot], scoreOf).map((p) => p.id)).toEqual(["hot", "newer", "cold", "closed"]);
  });
});
