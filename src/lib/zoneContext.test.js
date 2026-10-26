import { describe, expect, it } from "vitest";
import { cityMarketSummary, comparePricePerM2, pricePerM2, zonePriceStats } from "./zoneContext";

let n = 0;
const prop = (zone, price, area, extra = {}) => ({ id: `p${++n}`, zone, price, area_m2: area, type: "casa", status: "disponible", active: true, operation_type: "compra", ...extra });

describe("pricePerM2", () => {
  it("divide precio entre superficie y rechaza datos vacíos", () => {
    expect(pricePerM2({ price: 2000000, area_m2: 100 })).toBe(20000);
    expect(pricePerM2({ price: 2000000, area_m2: 0 })).toBeNull();
    expect(pricePerM2({ price: 0, area_m2: 100 })).toBeNull();
  });
});

describe("zonePriceStats", () => {
  const subject = prop("Torreón - Las Villas", 2000000, 100);

  it("usa la mediana de la misma colonia, sin contarse a sí misma", () => {
    const list = [subject, prop("Torreón - Las Villas", 1800000, 100), prop("Torreón - Las Villas", 2400000, 100), prop("Torreón - Las Villas", 9000000, 100)];
    const stats = zonePriceStats(subject, list);
    expect(stats).toMatchObject({ scope: "zone", count: 3, medianPerM2: 24000 });
  });

  it("si la colonia tiene pocas comparables, cae a toda la ciudad", () => {
    const list = [subject, prop("Torreón - Las Villas", 1800000, 100), prop("Torreón - Centro", 2200000, 100), prop("Torreón", 2000000, 100), prop("Torreón - Senderos", 2600000, 100)];
    const stats = zonePriceStats(subject, list);
    expect(stats).toMatchObject({ scope: "city", label: "Torreón", count: 4 });
  });

  it("no compara tipos distintos, rentas, vendidas ni inactivas", () => {
    const list = [
      subject,
      prop("Torreón - Las Villas", 1800000, 100, { type: "departamento" }),
      prop("Torreón - Las Villas", 1800000, 100, { operation_type: "renta" }),
      prop("Torreón - Las Villas", 1800000, 100, { status: "vendida" }),
      prop("Torreón - Las Villas", 1800000, 100, { active: false }),
    ];
    expect(zonePriceStats(subject, list)).toBeNull();
  });

  it("devuelve null si no hay con qué comparar", () => {
    expect(zonePriceStats(subject, [subject])).toBeNull();
    expect(zonePriceStats({ ...subject, zone: "" }, [])).toBeNull();
  });
});

describe("comparePricePerM2", () => {
  const stats = { medianPerM2: 20000 };

  it("marca por debajo, por encima y similar", () => {
    expect(comparePricePerM2({ price: 1700000, area_m2: 100 }, stats)).toEqual({ ownPerM2: 17000, diffPct: -15, verdict: "below" });
    expect(comparePricePerM2({ price: 2300000, area_m2: 100 }, stats)).toMatchObject({ diffPct: 15, verdict: "above" });
    expect(comparePricePerM2({ price: 2020000, area_m2: 100 }, stats).verdict).toBe("similar");
  });

  it("null sin estadística o sin superficie", () => {
    expect(comparePricePerM2({ price: 1, area_m2: 100 }, null)).toBeNull();
    expect(comparePricePerM2({ price: 1000000, area_m2: 0 }, stats)).toBeNull();
  });
});

describe("cityMarketSummary", () => {
  it("resume disponibles, precio mediano y m² por tipo (≥ 2 en cada tipo)", () => {
    const list = [
      prop("Torreón - A", 1000000, 100),
      prop("Torreón - B", 2000000, 100),
      prop("Torreón - C", 3000000, 100),
      prop("Torreón - D", 900000, 60, { type: "departamento" }),
      prop("Lerdo", 5000000, 100),
      prop("Torreón - E", 1, 1, { status: "vendida" }),
    ];
    expect(cityMarketSummary(list, "Torreón")).toEqual({ available: 4, medianPrice: 1500000, casaPerM2: 20000, departamentoPerM2: null });
  });

  it("null si la ciudad no tiene propiedades disponibles", () => {
    expect(cityMarketSummary([prop("Lerdo", 1000000, 100)], "Torreón")).toBeNull();
  });
});
