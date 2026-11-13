import { describe, expect, it } from "vitest";
import { dropAction, edgeScrollDelta, resolveSelected, splitOrder } from "./prospectBoard";

describe("dropAction", () => {
  const p = (over = {}) => ({ id: "p1", name: "Ana", stage: "nuevo", lost_reason: null, ...over });

  it("soltar en otra columna cambia la etapa", () => {
    expect(dropAction(p(), "contactado")).toEqual({ fields: { stage: "contactado", lost_reason: null }, confirm: false });
    expect(dropAction(p(), "cerrado")).toEqual({ fields: { stage: "cerrado", lost_reason: null }, confirm: false });
  });

  it("mandar a «perdido» pide confirmación y no toca el motivo (se captura después)", () => {
    expect(dropAction(p(), "perdido")).toEqual({ fields: { stage: "perdido" }, confirm: true });
  });

  it("sacarlo de «perdido» limpia el motivo", () => {
    expect(dropAction(p({ stage: "perdido", lost_reason: "Sin presupuesto" }), "interesado")).toEqual({ fields: { stage: "interesado", lost_reason: null }, confirm: false });
  });

  it("la misma columna, una que no existe o sin prospecto no hacen nada", () => {
    expect(dropAction(p(), "nuevo")).toBeNull();
    expect(dropAction(p(), "inventada")).toBeNull();
    expect(dropAction(p(), "")).toBeNull();
    expect(dropAction(null, "contactado")).toBeNull();
  });
});

describe("splitOrder / resolveSelected", () => {
  const list = [
    { id: "3", name: "Zoe", stage: "cerrado" },
    { id: "2", name: "Ángel", stage: "interesado" },
    { id: "1", name: "Beto", stage: "interesado" },
    { id: "0", name: "Carla", stage: "nuevo" },
  ];

  it("por etapa (de «nuevo» a «perdido») y, dentro de ella, por nombre con acentos bien", () => {
    expect(splitOrder(list).map((p) => p.id)).toEqual(["0", "2", "1", "3"]);
  });

  it("no cambia la lista original", () => {
    const copy = [...list];
    splitOrder(list);
    expect(list).toEqual(copy);
  });

  it("la ficha muestra el elegido, o el primero si ya no está en la lista, o nada si no hay lista", () => {
    const ordered = splitOrder(list);
    expect(resolveSelected(ordered, "1").id).toBe("1");
    expect(resolveSelected(ordered, "no-esta").id).toBe("0");
    expect(resolveSelected(ordered, null).id).toBe("0");
    expect(resolveSelected([], "1")).toBeNull();
  });
});

describe("edgeScrollDelta", () => {
  const rect = { left: 240, right: 1340 };
  it("cerca del borde derecho corre a la derecha, cerca del izquierdo a la izquierda, y en medio no mueve nada", () => {
    expect(edgeScrollDelta(rect, 1300)).toBe(24);
    expect(edgeScrollDelta(rect, 1340)).toBe(24);
    expect(edgeScrollDelta(rect, 260)).toBe(-24);
    expect(edgeScrollDelta(rect, 800)).toBe(0);
    expect(edgeScrollDelta(rect, 1259)).toBe(0); // justo antes de la zona del borde
  });
  it("la zona y el paso se pueden ajustar", () => {
    expect(edgeScrollDelta(rect, 1200, { edge: 200, step: 10 })).toBe(10);
  });
});
