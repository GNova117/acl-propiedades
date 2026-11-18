import { describe, expect, it } from "vitest";
import { STEPS, clampStep, firstStepWithErrors, progressPercent, stepOfField, stepsWithErrors } from "./propertyFormSteps";

describe("pasos del formulario de propiedad", () => {
  it("son cinco y los campos obligatorios caen en el paso que los muestra", () => {
    expect(STEPS).toHaveLength(5);
    expect(stepOfField("title")).toBe(0);
    expect(stepOfField("price")).toBe(0);
    expect(stepOfField("zone")).toBe(1);
    expect(stepOfField("lat")).toBe(1);
    expect(stepOfField("campo_desconocido")).toBe(0);
  });
  it("encuentra los pasos con errores, sin repetir y en orden", () => {
    expect(stepsWithErrors({ lat: "x", title: "x", address: "x" })).toEqual([0, 1]);
    expect(firstStepWithErrors({ address: "x" })).toBe(1);
    expect(firstStepWithErrors({})).toBeNull();
    expect(firstStepWithErrors(undefined)).toBeNull();
  });
  it("la barra avanza de 20 % a 100 % y no se sale de rango", () => {
    expect([0, 1, 2, 3, 4].map((s) => progressPercent(s))).toEqual([20, 40, 60, 80, 100]);
    expect(progressPercent(-3)).toBe(20);
    expect(progressPercent(99)).toBe(100);
    expect(clampStep("2")).toBe(2);
    expect(clampStep(NaN)).toBe(0);
  });
});
