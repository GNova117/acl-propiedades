import { describe, expect, it } from "vitest";
import { addressQuery, formatCoordinate } from "./addressSearch";

describe("addressQuery", () => {
  it("agrega la zona si la dirección no la menciona", () => {
    expect(addressQuery("Blvd. Revolución 100", "Centro")).toBe("Blvd. Revolución 100, Centro");
  });
  it("no repite la zona", () => {
    expect(addressQuery("Calle 5, Centro", "centro")).toBe("Calle 5, Centro");
  });
  it("sin dirección no hay búsqueda", () => {
    expect(addressQuery("  ", "Centro")).toBe("");
    expect(addressQuery(undefined, undefined)).toBe("");
  });
});

describe("formatCoordinate", () => {
  it("redondea a 6 decimales", () => {
    expect(formatCoordinate(25.541299999999)).toBe("25.5413");
    expect(formatCoordinate(-103.4067891234)).toBe("-103.406789");
  });
  it("valor inválido → vacío", () => {
    expect(formatCoordinate("abc")).toBe("");
  });
});
