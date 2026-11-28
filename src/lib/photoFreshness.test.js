import { describe, expect, it } from "vitest";
import { staleListingDays } from "./photoFreshness";

const NOW = new Date("2026-11-27T12:00:00Z");
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

describe("staleListingDays", () => {
  it("una disponible sin cambios en 6 meses o más se marca", () => {
    expect(staleListingDays({ status: "disponible", updated_at: daysAgo(200) }, NOW)).toBe(200);
    expect(staleListingDays({ status: "disponible", updated_at: daysAgo(180) }, NOW)).toBe(180);
  });
  it("reciente, vendida o desactivada no se marca", () => {
    expect(staleListingDays({ status: "disponible", updated_at: daysAgo(30) }, NOW)).toBeNull();
    expect(staleListingDays({ status: "vendida", updated_at: daysAgo(400) }, NOW)).toBeNull();
    expect(staleListingDays({ status: "disponible", active: false, updated_at: daysAgo(400) }, NOW)).toBeNull();
  });
  it("sin updated_at usa created_at; sin fechas no truena", () => {
    expect(staleListingDays({ status: "disponible", created_at: daysAgo(250) }, NOW)).toBe(250);
    expect(staleListingDays({ status: "disponible" }, NOW)).toBeNull();
    expect(staleListingDays(null, NOW)).toBeNull();
  });
});
