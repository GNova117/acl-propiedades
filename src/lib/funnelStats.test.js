import { describe, expect, it } from "vitest";
import { computeFunnel, FUNNEL_STAGES } from "./funnelStats";

describe("computeFunnel", () => {
  const prospects = [
    { id: 1, stage: "cerrado", created_at: "2026-01-01", source: "facebook", advisor_id: "a1" },
    { id: 2, stage: "perdido", created_at: "2026-01-05", source: "facebook", advisor_id: "a1", lost_reason: "Precio alto" },
    { id: 3, stage: "interesado", created_at: "2026-01-10", source: "referido", advisor_id: "a2" },
    { id: 4, stage: "nuevo", created_at: "2026-01-15" },
  ];
  const history = [
    { prospecto_id: 1, stage: "contactado", at: "2026-01-02" },
    { prospecto_id: 1, stage: "interesado", at: "2026-01-03" },
    { prospecto_id: 1, stage: "negociacion", at: "2026-01-04" },
    { prospecto_id: 1, stage: "cerrado", at: "2026-01-10" },
  ];

  it("cuenta total, cerrados, perdidos y activos (los que siguen en una etapa abierta)", () => {
    const r = computeFunnel({ prospects, history });
    expect(r.total).toBe(4);
    expect(r.closed).toBe(1);
    expect(r.lost).toBe(1);
    expect(r.active).toBe(2);
    expect(r.closeRate).toBe(25);
  });

  it("los días para cerrar se miden desde la creación hasta el paso a 'cerrado' del historial", () => {
    const r = computeFunnel({ prospects, history });
    expect(r.avgDaysToClose).toBe(9);
    expect(r.medianDaysToClose).toBe(9);
  });

  it("un prospecto llegó a una etapa si pasó por ella o por una posterior, aunque su campo 'stage' no lo diga", () => {
    const r = computeFunnel({ prospects, history });
    const byStage = Object.fromEntries(r.funnel.map((f) => [f.stage, f]));
    expect(byStage.nuevo.reached).toBe(4); // todos pasan por "nuevo"
    expect(byStage.contactado.reached).toBe(2); // solo el #1 (vía historial)
    expect(byStage.interesado.reached).toBe(2); // #1 (historial) y #3 (stage actual)
    expect(byStage.negociacion.reached).toBe(1);
    expect(byStage.cerrado.reached).toBe(1);
  });

  it("la conversión entre etapas es sobre los que llegaron a la etapa anterior, no sobre el total", () => {
    const r = computeFunnel({ prospects, history });
    const byStage = Object.fromEntries(r.funnel.map((f) => [f.stage, f]));
    expect(byStage.nuevo.conversionFromPrev).toBeNull();
    expect(byStage.contactado.conversionFromPrev).toBe(50); // 2 de 4
    expect(byStage.interesado.conversionFromPrev).toBe(100); // 2 de 2
    expect(byStage.cerrado.conversionFromPrev).toBe(100); // 1 de 1
  });

  it("agrupa los motivos de pérdida normalizando mayúsculas y espacios", () => {
    const r = computeFunnel({ prospects, history });
    expect(r.lostReasons).toEqual([{ reason: "Precio alto", count: 1 }]);
  });

  it("agrupa por fuente y por asesor, usando 'manual' cuando la fuente no viene puesta", () => {
    const r = computeFunnel({ prospects, history });
    expect(r.bySource[0]).toMatchObject({ key: "facebook", total: 2, closed: 1, lost: 1 });
    expect(r.bySource.find((g) => g.key === "manual")).toMatchObject({ total: 1 });
    expect(r.byAdvisor.find((g) => g.key === "a1")).toMatchObject({ total: 2 });
    expect(r.byAdvisor.find((g) => g.key === "")).toMatchObject({ total: 1 });
  });

  it("periodDays limita el embudo a los prospectos creados en esa ventana", () => {
    const recent = [
      { id: 1, stage: "nuevo", created_at: "2026-01-01" },
      { id: 2, stage: "nuevo", created_at: "2026-01-15" },
    ];
    const r = computeFunnel({ prospects: recent, history: [], periodDays: 5, now: new Date("2026-01-16") });
    expect(r.total).toBe(1);
  });

  it("FUNNEL_STAGES no incluye 'perdido': estar perdido no es una etapa del embudo", () => {
    expect(FUNNEL_STAGES).not.toContain("perdido");
  });
});
