import { describe, expect, it } from "vitest";
import { FLOOR_PLAN_MAX_BYTES, floorPlanFileError } from "./floorPlan";

describe("floorPlanFileError", () => {
  it("acepta PNG y JPG dentro del tamaño", () => {
    expect(floorPlanFileError({ type: "image/png", size: 1000 })).toBeNull();
    expect(floorPlanFileError({ type: "image/jpeg", size: FLOOR_PLAN_MAX_BYTES })).toBeNull();
  });
  it("rechaza otros tipos (PDF, WebP, SVG) y archivos demasiado pesados", () => {
    expect(floorPlanFileError({ type: "application/pdf", size: 1000 })).toBe("floorPlan.invalidType");
    expect(floorPlanFileError({ type: "image/svg+xml", size: 1000 })).toBe("floorPlan.invalidType");
    expect(floorPlanFileError({ type: "image/png", size: FLOOR_PLAN_MAX_BYTES + 1 })).toBe("floorPlan.tooBig");
    expect(floorPlanFileError(null)).toBe("floorPlan.invalidType");
  });
});
