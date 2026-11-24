import { describe, expect, it } from "vitest";
import { canMerge, mergedProspectFields } from "./mergeProspects";

const base = { id: "k", name: "Luis Pérez", phone: "8711111111", email: null, stage: "contactado", advisor_id: "a1", notes: "nota A", created_at: "2026-11-10T10:00:00Z", last_contact_at: "2026-11-14T10:00:00Z", next_followup_at: "2026-11-26" };
const other = { id: "r", name: "Luis P.", phone: null, email: "luis@x.mx", stage: "negociacion", advisor_id: "a1", notes: "nota B", visit_id: "v1", created_at: "2026-10-28T10:00:00Z", last_contact_at: "2026-11-16T10:00:00Z", next_followup_at: "2026-11-19" };

describe("mergedProspectFields", () => {
  it("respeta lo del conservado y llena los huecos con lo del otro", () => {
    const m = mergedProspectFields(base, other);
    expect(m.phone).toBe("8711111111");
    expect(m.email).toBe("luis@x.mx");
    expect(m.visit_id).toBe("v1");
  });
  it("junta las notas sin perder ninguna y dice de quién viene la segunda", () => {
    expect(mergedProspectFields(base, other).notes).toBe("nota A\n\nFusionado con «Luis P.»: nota B");
    expect(mergedProspectFields({ ...base, notes: null }, { ...other, notes: null }).notes).toBeNull();
  });
  it("etapa más avanzada, seguimiento más próximo, alta más antigua y contacto más reciente", () => {
    const m = mergedProspectFields(base, other);
    expect(m.stage).toBe("negociacion");
    expect(m.next_followup_at).toBe("2026-11-19");
    expect(m.created_at).toBe("2026-10-28T10:00:00Z");
    expect(m.last_contact_at).toBe("2026-11-16T10:00:00Z");
  });
  it("«perdido» pierde contra cualquier etapa abierta y solo conserva el motivo si siguen perdidos", () => {
    expect(mergedProspectFields({ ...base, stage: "perdido", lost_reason: "x" }, { ...other, stage: "nuevo" }).stage).toBe("nuevo");
    expect(mergedProspectFields({ ...base, stage: "perdido", lost_reason: "x" }, { ...other, stage: "nuevo" }).lost_reason).toBeNull();
    const both = mergedProspectFields({ ...base, stage: "perdido", lost_reason: null }, { ...other, stage: "perdido", lost_reason: "ya compró" });
    expect(both.stage).toBe("perdido");
    expect(both.lost_reason).toBe("ya compró");
  });
  it("tolera fechas faltantes", () => {
    const m = mergedProspectFields({ ...base, next_followup_at: null, last_contact_at: null }, { ...other, next_followup_at: null, last_contact_at: null });
    expect(m.next_followup_at).toBeNull();
    expect(m.last_contact_at).toBeNull();
  });
});

describe("canMerge", () => {
  it("la oficina fusiona cualquiera; un asesor solo los dos propios; nunca uno consigo mismo", () => {
    expect(canMerge(base, other, null)).toBe(true);
    expect(canMerge(base, other, "a1")).toBe(true);
    expect(canMerge(base, { ...other, advisor_id: "a2" }, "a1")).toBe(false);
    expect(canMerge(base, base, null)).toBe(false);
    expect(canMerge(null, other)).toBe(false);
  });
});
