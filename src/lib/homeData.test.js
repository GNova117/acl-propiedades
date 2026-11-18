import { describe, expect, it } from "vitest";
import { FEATURED_POOL, buildHomeData } from "./homeData";
import { MAX_FEATURED, pickFeaturedProperties } from "./propertyBadges";
import { pickVideoTours } from "./videoTours";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const day = (n) => new Date(NOW - n * 86400000).toISOString();
let seq = 0;
const prop = (over = {}) => ({ id: `p${++seq}`, type: "casa", status: "disponible", active: true, main_image: "x.jpg", created_at: day(5), price: 1000000, ...over });

describe("buildHomeData", () => {
  it("cuenta por tipo solo las activas y las disponibles aparte", () => {
    const data = buildHomeData([prop(), prop({ status: "vendida" }), prop({ type: "terreno" }), prop({ active: false }), prop({ type: "nave_industrial", status: "apartada" })], { now: NOW });
    expect(data.counts).toEqual({ casa: 2, terreno: 1, nave_industrial: 1 });
    expect(data.availableCount).toBe(2);
  });

  it("las candidatas dan exactamente las mismas destacadas que con todo el catálogo", () => {
    const all = [];
    for (let i = 0; i < 40; i += 1) all.push(prop({ created_at: day(i + 1) })); // 40 sin rebaja, de la más nueva a la más vieja
    for (let i = 0; i < 4; i += 1) all.push(prop({ created_at: day(300 + i), previous_price: 1200000, price: 1000000, price_changed_at: day(3) })); // viejas pero con rebaja reciente
    const full = pickFeaturedProperties(all, { now: NOW }).map((p) => p.id);
    const fromPool = pickFeaturedProperties(buildHomeData(all, { now: NOW }).featuredPool, { now: NOW }).map((p) => p.id);
    expect(fromPool).toEqual(full);
    expect(full.length).toBe(MAX_FEATURED);
    expect(buildHomeData(all, { now: NOW }).featuredPool.length).toBeLessThanOrEqual(FEATURED_POOL * 2);
  });

  it("las candidatas de video dan los mismos recorridos", () => {
    const all = Array.from({ length: 30 }, (_, i) => prop({ created_at: day(i + 1), videos: i % 2 ? ["v.mp4"] : [] }));
    const full = pickVideoTours(all).map((e) => e.property.id);
    const fromPool = pickVideoTours(buildHomeData(all, { now: NOW }).videoPool).map((e) => e.property.id);
    expect(fromPool).toEqual(full);
  });

  it("sin propiedades no truena", () => {
    expect(buildHomeData(null)).toEqual({ counts: {}, availableCount: 0, featuredPool: [], videoPool: [] });
  });
});
