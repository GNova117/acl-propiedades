import { describe, expect, it } from "vitest";
import { isClosedStatus } from "./propertyStatus";

describe("isClosedStatus", () => {
  it("vendida y rentada están cerradas", () => {
    expect(isClosedStatus("vendida")).toBe(true);
    expect(isClosedStatus("rentada")).toBe(true);
  });
  it("disponible y apartada siguen abiertas", () => {
    expect(isClosedStatus("disponible")).toBe(false);
    expect(isClosedStatus("apartada")).toBe(false);
    expect(isClosedStatus(undefined)).toBe(false);
  });
});
