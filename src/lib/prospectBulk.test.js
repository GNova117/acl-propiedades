import { describe, expect, it, vi } from "vitest";
import { applyBulk, bulkFields, followupDate } from "./prospectBulk";

describe("bulkFields · etapa", () => {
  it("cambia la etapa y limpia el motivo de pérdida", () => {
    expect(bulkFields("stage", "interesado", { stage: "perdido", lost_reason: "precio" })).toEqual({ stage: "interesado", lost_reason: null });
  });

  it("al pasar a «perdido» no toca el motivo (se captura aparte)", () => {
    expect(bulkFields("stage", "perdido", { stage: "nuevo" })).toEqual({ stage: "perdido" });
  });

  it("sin cambio si ya está en esa etapa o no se eligió ninguna", () => {
    expect(bulkFields("stage", "nuevo", { stage: "nuevo" })).toBeNull();
    expect(bulkFields("stage", "", { stage: "nuevo" })).toBeNull();
  });
});

describe("bulkFields · seguimiento", () => {
  it("pone la fecha en un prospecto de etapa abierta", () => {
    expect(bulkFields("followup", "2026-11-13", { stage: "contactado", next_followup_at: null })).toEqual({ next_followup_at: "2026-11-13" });
  });

  it("una fecha vacía quita el seguimiento", () => {
    expect(bulkFields("followup", "", { stage: "interesado", next_followup_at: "2026-11-20" })).toEqual({ next_followup_at: null });
  });

  it("sin cambio si ya tiene esa fecha, o si no tiene seguimiento y se pide quitarlo", () => {
    expect(bulkFields("followup", "2026-11-13", { stage: "nuevo", next_followup_at: "2026-11-13" })).toBeNull();
    expect(bulkFields("followup", "", { stage: "nuevo", next_followup_at: null })).toBeNull();
    expect(bulkFields("followup", "", { stage: "nuevo" })).toBeNull();
  });

  it("un prospecto cerrado o perdido no tiene seguimiento: no aplica", () => {
    expect(bulkFields("followup", "2026-11-13", { stage: "cerrado" })).toBeNull();
    expect(bulkFields("followup", "2026-11-13", { stage: "perdido" })).toBeNull();
  });
});

describe("bulkFields · asesor", () => {
  it("reasigna al asesor elegido", () => {
    expect(bulkFields("advisor", "advisor-2", { advisor_id: "advisor-1" })).toEqual({ advisor_id: "advisor-2" });
    expect(bulkFields("advisor", "advisor-2", { advisor_id: null })).toEqual({ advisor_id: "advisor-2" });
  });

  it("sin cambio si ya es suyo o no se eligió asesor", () => {
    expect(bulkFields("advisor", "advisor-1", { advisor_id: "advisor-1" })).toBeNull();
    expect(bulkFields("advisor", "", { advisor_id: "advisor-1" })).toBeNull();
  });

  it("una acción desconocida no cambia nada", () => {
    expect(bulkFields("otra", "x", { stage: "nuevo" })).toBeNull();
  });
});

describe("followupDate", () => {
  it("da la fecha dentro de N días, o vacío para quitarla", () => {
    expect(followupDate(1, new Date(2026, 10, 12))).toBe("2026-11-13");
    expect(followupDate(14, new Date(2026, 10, 30))).toBe("2026-12-14");
    expect(followupDate(null)).toBe("");
  });
});

describe("applyBulk", () => {
  const rows = [
    { id: "a", stage: "nuevo" },
    { id: "b", stage: "contactado" },
    { id: "c", stage: "interesado" },
  ];

  it("aplica a cada prospecto, uno por uno y en orden, y devuelve los registros actualizados", async () => {
    const order = [];
    const db = {
      updateProspect: vi.fn(async (id, fields) => {
        order.push(id);
        await new Promise((resolve) => setTimeout(resolve, id === "a" ? 5 : 0)); // el primero tarda más: si fuera en paralelo, saldría después
        return { id, ...fields };
      }),
    };
    const result = await applyBulk(db, rows, "stage", "negociacion");
    expect(order).toEqual(["a", "b", "c"]);
    expect(result).toEqual({ updated: [{ id: "a", stage: "negociacion", lost_reason: null }, { id: "b", stage: "negociacion", lost_reason: null }, { id: "c", stage: "negociacion", lost_reason: null }], skipped: 0, failed: 0 });
  });

  it("cuenta aparte los que no tenían nada que cambiar", async () => {
    const db = { updateProspect: vi.fn(async (id, fields) => ({ id, ...fields })) };
    const result = await applyBulk(db, rows, "stage", "contactado");
    expect(db.updateProspect).toHaveBeenCalledTimes(2);
    expect(result.skipped).toBe(1);
    expect(result.updated.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("un fallo no detiene a los demás y se cuenta", async () => {
    const db = {
      updateProspect: vi.fn(async (id, fields) => {
        if (id === "b") throw new Error("sin permiso");
        return { id, ...fields };
      }),
    };
    const result = await applyBulk(db, rows, "advisor", "advisor-9");
    expect(result.failed).toBe(1);
    expect(result.updated.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("sin prospectos no hace nada", async () => {
    const db = { updateProspect: vi.fn() };
    expect(await applyBulk(db, [], "stage", "nuevo")).toEqual({ updated: [], skipped: 0, failed: 0 });
    expect(db.updateProspect).not.toHaveBeenCalled();
  });
});
