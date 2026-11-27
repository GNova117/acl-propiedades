import { describe, expect, it } from "vitest";
import { filterZones, normalizeZoneText } from "./zoneSearch";

const ZONES = [
  { id: 1, name: "Torre Aurora" },
  { id: 2, name: "La Rosita" },
  { id: 3, name: "Cañada Real" },
  { id: 4, name: "Residencial Torreón Jardín" },
  { id: 5, name: "" },
];

describe("normalizeZoneText", () => {
  it("quita acentos y mayúsculas", () => {
    expect(normalizeZoneText("  CAÑADA Torreón ")).toBe("canada torreon");
    expect(normalizeZoneText(null)).toBe("");
  });
});

describe("filterZones", () => {
  it("sin texto devuelve todas las zonas con nombre, en su orden", () => {
    expect(filterZones(ZONES, "").map((z) => z.id)).toEqual([1, 2, 3, 4]);
  });

  it("encuentra sin importar acentos ni mayúsculas", () => {
    expect(filterZones(ZONES, "CANADA").map((z) => z.id)).toEqual([3]);
    expect(filterZones(ZONES, "rosita").map((z) => z.id)).toEqual([2]);
  });

  it("primero las que empiezan con el texto y luego las que lo contienen", () => {
    expect(filterZones(ZONES, "torre").map((z) => z.id)).toEqual([1, 4]);
    expect(filterZones(ZONES, "real").map((z) => z.id)).toEqual([3]);
    expect(filterZones(ZONES, "jardin").map((z) => z.id)).toEqual([4]);
  });

  it("respeta el límite y tolera listas vacías o texto sin coincidencias", () => {
    expect(filterZones(ZONES, "", 2)).toHaveLength(2);
    expect(filterZones(undefined, "x")).toEqual([]);
    expect(filterZones(ZONES, "zzz")).toEqual([]);
  });
});
