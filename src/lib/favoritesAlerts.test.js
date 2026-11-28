import { describe, expect, it } from "vitest";
import { favoritesAlerts } from "./favoritesAlerts";

const NOW = Date.parse("2026-11-27T12:00:00Z");
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

describe("favoritesAlerts", () => {
  it("cuenta rebajas vigentes y propiedades que ya no están disponibles", () => {
    const list = [
      { status: "disponible", price: 800, previous_price: 1000, price_changed_at: daysAgo(2) },
      { status: "disponible", price: 800, previous_price: 1000, price_changed_at: daysAgo(90) },
      { status: "vendida", price: 500 },
      { status: "apartada", price: 500 },
      { status: "disponible", price: 500 },
    ];
    expect(favoritesAlerts(list, NOW)).toEqual({ dropped: 1, unavailable: 2 });
  });
  it("lista vacía o nula", () => {
    expect(favoritesAlerts([], NOW)).toEqual({ dropped: 0, unavailable: 0 });
    expect(favoritesAlerts(null, NOW)).toEqual({ dropped: 0, unavailable: 0 });
  });
});
