import { describe, expect, it } from "vitest";
import { generateVisitorId } from "./visitorId";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateVisitorId", () => {
  it("genera un UUID v4 válido (se envía como parámetro uuid a Supabase)", () => {
    expect(generateVisitorId()).toMatch(UUID_RE);
  });

  it("genera ids distintos en cada llamada", () => {
    expect(generateVisitorId()).not.toBe(generateVisitorId());
  });
});
