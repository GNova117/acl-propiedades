import { describe, expect, it } from "vitest";
import { ALERT_AFTER, alertPlacement } from "./listingAlert";

describe("alertPlacement", () => {
  it("con pocos resultados va al final", () => {
    expect(alertPlacement(0)).toBe("end");
    expect(alertPlacement(ALERT_AFTER)).toBe("end");
  });
  it("con más de una tanda se mete dentro de la rejilla", () => {
    expect(alertPlacement(ALERT_AFTER + 1)).toBe("inline");
    expect(alertPlacement(24)).toBe("inline");
  });
  it("el límite se puede cambiar y un valor raro no truena", () => {
    expect(alertPlacement(4, 3)).toBe("inline");
    expect(alertPlacement(undefined)).toBe("end");
  });
});
