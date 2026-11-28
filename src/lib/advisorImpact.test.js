import { describe, expect, it } from "vitest";
import { advisorImpact } from "./advisorImpact";

describe("advisorImpact", () => {
  const data = {
    citas: [
      { advisor_id: "a1", fecha: "2026-12-01", status: "confirmada" },
      { advisor_id: "a1", fecha: "2026-11-01", status: "confirmada" }, // pasada
      { advisor_id: "a1", fecha: "2026-12-02", status: "cancelada" },
      { advisor_id: "a2", fecha: "2026-12-03", status: "confirmada" },
    ],
    prospects: [
      { advisor_id: "a1", stage: "nuevo" },
      { advisor_id: "a1", stage: "ganado" },
      { advisor_id: "a2", stage: "nuevo" },
    ],
    properties: [{ advisor_ids: ["a1", "a2"] }, { advisor_ids: ["a2"] }, { advisor_ids: [] }],
  };
  it("cuenta solo lo que queda sin responsable", () => {
    expect(advisorImpact("a1", data, "2026-11-27")).toEqual({ upcomingCitas: 1, openProspects: 1, ownedProperties: 1, total: 3 });
  });
  it("un asesor sin nada no tiene impacto", () => {
    expect(advisorImpact("zz", data, "2026-11-27").total).toBe(0);
  });
});
