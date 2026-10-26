import { describe, expect, it } from "vitest";
import { applyPriceChange, getPriceDrop, getPropertyBadge, pickFeaturedProperties } from "./propertyBadges";

const NOW = new Date("2026-10-26T12:00:00Z").getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();
const base = { id: "p", status: "disponible", active: true, main_image: "x.jpg", price: 1000000, created_at: daysAgo(100) };

describe("getPriceDrop", () => {
  it("detecta una rebaja reciente y calcula el porcentaje", () => {
    const drop = getPriceDrop({ ...base, previous_price: 1250000, price_changed_at: daysAgo(3) }, NOW);
    expect(drop).toEqual({ previousPrice: 1250000, percent: 20 });
  });

  it("la apaga pasados 30 días", () => {
    expect(getPriceDrop({ ...base, previous_price: 1250000, price_changed_at: daysAgo(31) }, NOW)).toBeNull();
  });

  it("no cuenta si el precio anterior no es mayor", () => {
    expect(getPriceDrop({ ...base, previous_price: 1000000, price_changed_at: daysAgo(1) }, NOW)).toBeNull();
    expect(getPriceDrop({ ...base, previous_price: 900000, price_changed_at: daysAgo(1) }, NOW)).toBeNull();
  });

  it("sin datos de rebaja (columnas aún no creadas) no falla", () => {
    expect(getPriceDrop(base, NOW)).toBeNull();
  });
});

describe("getPropertyBadge", () => {
  it("marca como nueva una propiedad dada de alta hace poco", () => {
    expect(getPropertyBadge({ ...base, created_at: daysAgo(5) }, NOW)).toEqual({ kind: "new" });
    expect(getPropertyBadge({ ...base, created_at: daysAgo(15) }, NOW)).toBeNull();
  });

  it("la rebaja gana sobre 'Nuevo'", () => {
    const badge = getPropertyBadge({ ...base, created_at: daysAgo(2), previous_price: 1100000, price_changed_at: daysAgo(1) }, NOW);
    expect(badge.kind).toBe("priceDrop");
    expect(badge.percent).toBe(9);
  });

  it("no etiqueta apartadas ni vendidas", () => {
    expect(getPropertyBadge({ ...base, status: "apartada", created_at: daysAgo(1) }, NOW)).toBeNull();
    expect(getPropertyBadge({ ...base, status: "vendida", created_at: daysAgo(1) }, NOW)).toBeNull();
  });
});

describe("applyPriceChange", () => {
  const current = { price: 1000000, previous_price: null, price_changed_at: null };

  it("al bajar guarda el precio anterior y la fecha", () => {
    expect(applyPriceChange(current, 900000, NOW)).toEqual({ previous_price: 1000000, price_changed_at: new Date(NOW).toISOString() });
  });

  it("al subir borra la rebaja", () => {
    const dropped = { price: 900000, previous_price: 1000000, price_changed_at: daysAgo(2) };
    expect(applyPriceChange(dropped, 950000, NOW).previous_price).toBeNull();
  });

  it("sin cambio de precio conserva lo que había", () => {
    const dropped = { price: 900000, previous_price: 1000000, price_changed_at: daysAgo(2) };
    expect(applyPriceChange(dropped, 900000, NOW)).toEqual({ previous_price: 1000000, price_changed_at: dropped.price_changed_at });
  });
});

describe("pickFeaturedProperties", () => {
  it("pone primero las rebajadas y luego las más recientes; excluye no disponibles", () => {
    const list = [
      { ...base, id: "viejaSinRebaja", created_at: daysAgo(90) },
      { ...base, id: "nueva", created_at: daysAgo(2) },
      { ...base, id: "rebajada", created_at: daysAgo(60), previous_price: 1200000, price_changed_at: daysAgo(4) },
      { ...base, id: "vendida", status: "vendida", created_at: daysAgo(1) },
      { ...base, id: "inactiva", active: false, created_at: daysAgo(1) },
      { ...base, id: "sinFoto", main_image: "", created_at: daysAgo(1) },
    ];
    expect(pickFeaturedProperties(list, { now: NOW }).map((p) => p.id)).toEqual(["rebajada", "nueva", "viejaSinRebaja"]);
  });

  it("respeta el límite", () => {
    const list = Array.from({ length: 10 }, (_, i) => ({ ...base, id: `p${i}`, created_at: daysAgo(i) }));
    expect(pickFeaturedProperties(list, { limit: 4, now: NOW })).toHaveLength(4);
  });
});
