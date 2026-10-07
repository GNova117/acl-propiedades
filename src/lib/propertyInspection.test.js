import { describe, expect, it } from "vitest";
import {
  computeDiagnosis,
  emptyChecklist,
  failedItems,
  isChecklistComplete,
  normalizeChecklist,
  toChecklistFields,
  toInspectionFields,
  validateInspectionForm,
} from "./propertyInspection";

describe("computeDiagnosis", () => {
  it("todo bien (o N/A) da verde", () => {
    const checklist = emptyChecklist().map((e) => ({ ...e, estado: "si" }));
    expect(computeDiagnosis(checklist)).toBe("verde");
  });

  it("una falla no crítica (ej. aplanados) da amarillo", () => {
    const checklist = emptyChecklist().map((e) => ({ ...e, estado: "si" }));
    const withFail = checklist.map((e) => (e.category === "estructura" && e.key === "aplanados" ? { ...e, estado: "no" } : e));
    expect(computeDiagnosis(withFail)).toBe("amarillo");
  });

  it("una sola falla crítica (ej. sin agua) da rojo, aunque el resto esté bien", () => {
    const checklist = emptyChecklist().map((e) => ({ ...e, estado: "si" }));
    const withFail = checklist.map((e) => (e.category === "servicios" && e.key === "agua" ? { ...e, estado: "no" } : e));
    expect(computeDiagnosis(withFail)).toBe("rojo");
  });

  it("rojo manda sobre amarillo cuando hay fallas de ambos tipos", () => {
    const checklist = emptyChecklist().map((e) => ({ ...e, estado: "si" }));
    const withFails = checklist.map((e) => {
      if (e.category === "estructura" && e.key === "aplanados") return { ...e, estado: "no" };
      if (e.category === "servicios" && e.key === "agua") return { ...e, estado: "no" };
      return e;
    });
    expect(computeDiagnosis(withFails)).toBe("rojo");
  });

  it("un criterio que ya no existe en la configuración se trata como crítico por seguridad", () => {
    expect(computeDiagnosis([{ category: "ya_no_existe", key: "x", estado: "no" }])).toBe("rojo");
  });
});

describe("failedItems / isChecklistComplete", () => {
  it("failedItems solo devuelve las filas marcadas 'no'", () => {
    const checklist = [{ estado: "si" }, { estado: "no" }, { estado: "na" }];
    expect(failedItems(checklist)).toHaveLength(1);
  });

  it("un checklist está completo solo si todas las filas tienen una respuesta válida", () => {
    expect(isChecklistComplete([{ estado: "si" }, { estado: "no" }])).toBe(true);
    expect(isChecklistComplete([{ estado: "si" }, { estado: "" }])).toBe(false);
  });
});

describe("normalizeChecklist", () => {
  it("completa con las filas que falten (un criterio agregado después de crear el registro)", () => {
    const normalized = normalizeChecklist([]);
    expect(normalized).toHaveLength(emptyChecklist().length);
    expect(normalized.every((e) => e.estado === "")).toBe(true);
  });

  it("conserva la respuesta ya guardada en vez de pisarla con una fila vacía", () => {
    const saved = [{ category: "estructura", key: "grietas", estado: "no", file_path: "foto.jpg" }];
    const normalized = normalizeChecklist(saved);
    const row = normalized.find((e) => e.category === "estructura" && e.key === "grietas");
    expect(row.estado).toBe("no");
    expect(row.file_path).toBe("foto.jpg");
  });

  it("nunca descarta un criterio que ya no está en la configuración actual (no se pierde una foto ya capturada)", () => {
    const saved = [{ category: "vieja_categoria", key: "viejo_criterio", estado: "no", file_path: "foto.jpg" }];
    const normalized = normalizeChecklist(saved);
    expect(normalized.some((e) => e.category === "vieja_categoria" && e.key === "viejo_criterio")).toBe(true);
  });
});

describe("validateInspectionForm", () => {
  const validForm = { folio: "INSP-1", direccion: "Calle 1", inspector: "Juan", visited_at: "2026-01-01T10:00", checklist: emptyChecklist().map((e) => ({ ...e, estado: "si" })) };

  it("exige folio, dirección, inspector, fecha y el checklist completo", () => {
    expect(validateInspectionForm({ ...validForm, folio: "" }).folio).toBe(true);
    expect(validateInspectionForm({ ...validForm, direccion: "" }).direccion).toBe(true);
    expect(validateInspectionForm({ ...validForm, visited_at: "" }).visited_at).toBe(true);
    expect(validateInspectionForm({ ...validForm, checklist: emptyChecklist() }).checklist).toBe(true);
  });

  it("sin errores cuando todo está lleno y el checklist completo", () => {
    expect(validateInspectionForm(validForm)).toEqual({});
  });
});

describe("toChecklistFields / toInspectionFields", () => {
  it("toChecklistFields traduce 'removed' a file_path null, nunca ambos a la vez", () => {
    const fields = toChecklistFields([{ category: "a", key: "b", estado: "no", file_path: "old.jpg", removed: true }]);
    expect(fields[0].file_path).toBeNull();
    expect(fields[0].removed).toBe(true);
  });

  it("toInspectionFields recalcula el estatus a partir del checklist, no confía en uno guardado aparte", () => {
    const checklist = emptyChecklist().map((e) => (e.category === "servicios" && e.key === "agua" ? { ...e, estado: "no" } : { ...e, estado: "si" }));
    const fields = toInspectionFields({ folio: "INSP-1", property_id: "p1", direccion: "Calle 1", inspector: "Juan", visited_at: "2026-01-01T10:00", checklist, observaciones: "", signature: null, existingSignature: null, signedBy: "" });
    expect(fields.estatus).toBe("rojo");
  });

  it("signed_by sale del inspector cuando se firmó en esta sesión, o se conserva el que ya había", () => {
    const base = { folio: "INSP-1", property_id: "p1", direccion: "Calle 1", inspector: "Juan Pérez", visited_at: "2026-01-01T10:00", checklist: emptyChecklist().map((e) => ({ ...e, estado: "si" })), observaciones: "" };
    const freshlySigned = toInspectionFields({ ...base, signature: { image: "data:img" }, existingSignature: null, signedBy: "" });
    expect(freshlySigned.signed_by).toBe("Juan Pérez");
    expect(freshlySigned.signature_data).toBe("data:img");

    const alreadySigned = toInspectionFields({ ...base, signature: null, existingSignature: "data:old", signedBy: "Pedro" });
    expect(alreadySigned.signed_by).toBe("Pedro");
    expect(alreadySigned.signature_data).toBe("data:old");
  });
});
