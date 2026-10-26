import { describe, expect, it } from "vitest";
import { buildOverpassQuery, categoryOf, distanceMeters, formatDistance, hasNearbyData, parseCoords, summarizeNearby } from "./nearbyPlaces";

const LAT = 25.54;
const LNG = -103.4;
// ~0.001° de latitud ≈ 111 m
const at = (dLat, tags, extra = {}) => ({ type: "node", lat: LAT + dLat, lon: LNG, tags, ...extra });

describe("buildOverpassQuery", () => {
  it("incluye el radio, las coordenadas y todas las categorías", () => {
    const q = buildOverpassQuery(LAT, LNG, 1500);
    expect(q).toContain("around:1500,25.54000,-103.40000");
    for (const value of ["school", "hospital", "supermarket", "park"]) expect(q).toContain(value);
    expect(q.startsWith("[out:json]")).toBe(true);
    expect(q).toContain("out center");
  });
});

describe("categoryOf", () => {
  it("clasifica por etiquetas de OSM", () => {
    expect(categoryOf({ amenity: "kindergarten" })).toBe("schools");
    expect(categoryOf({ amenity: "clinic" })).toBe("health");
    expect(categoryOf({ shop: "supermarket" })).toBe("shopping");
    expect(categoryOf({ leisure: "park" })).toBe("parks");
    expect(categoryOf({ amenity: "bar" })).toBeNull();
    expect(categoryOf(undefined)).toBeNull();
  });
});

describe("distanceMeters", () => {
  it("calcula distancias razonables", () => {
    expect(distanceMeters(LAT, LNG, LAT, LNG)).toBe(0);
    expect(Math.round(distanceMeters(LAT, LNG, LAT + 0.01, LNG))).toBeGreaterThan(1100);
    expect(Math.round(distanceMeters(LAT, LNG, LAT + 0.01, LNG))).toBeLessThan(1120);
  });
});

describe("summarizeNearby", () => {
  it("cuenta por categoría, ordena por cercanía y redondea la distancia", () => {
    const elements = [
      at(0.006, { amenity: "school", name: "Primaria Lejana" }),
      at(0.002, { amenity: "school", name: "Primaria Cercana" }),
      at(0.003, { amenity: "hospital", name: "Hospital General" }),
      at(0.001, { shop: "supermarket", name: "Súper Uno" }),
    ];
    const s = summarizeNearby(elements, LAT, LNG);
    expect(s.schools.count).toBe(2);
    expect(s.schools.nearest.map((p) => p.name)).toEqual(["Primaria Cercana", "Primaria Lejana"]);
    expect(s.schools.nearest[0].distanceM % 10).toBe(0);
    expect(s.health.nearest[0].name).toBe("Hospital General");
    expect(s.parks.count).toBe(0);
  });

  it("usa el centro de los ways y no repite un mismo nombre", () => {
    const elements = [
      { type: "way", center: { lat: LAT + 0.002, lon: LNG }, tags: { amenity: "school", name: "Colegio X" } },
      { type: "way", center: { lat: LAT + 0.0025, lon: LNG }, tags: { amenity: "school", name: "Colegio X" } },
    ];
    const s = summarizeNearby(elements, LAT, LNG);
    expect(s.schools.count).toBe(1);
  });

  it("cuenta lugares sin nombre pero no los lista, y respeta el máximo", () => {
    const elements = [
      at(0.001, { leisure: "park" }),
      ...["A", "B", "C", "D"].map((name, i) => at(0.002 + i * 0.0005, { amenity: "school", name })),
    ];
    const s = summarizeNearby(elements, LAT, LNG);
    expect(s.parks).toEqual({ count: 1, nearest: [] });
    expect(s.schools.count).toBe(4);
    expect(s.schools.nearest).toHaveLength(3);
  });

  it("descarta elementos fuera del radio o sin coordenadas, y tolera entradas vacías", () => {
    const elements = [at(0.05, { amenity: "school", name: "Muy lejos" }), { type: "node", tags: { amenity: "school", name: "Sin coords" } }];
    expect(summarizeNearby(elements, LAT, LNG).schools.count).toBe(0);
    expect(hasNearbyData(summarizeNearby(undefined, LAT, LNG))).toBe(false);
  });
});

describe("formatDistance", () => {
  it("usa metros o kilómetros", () => {
    expect(formatDistance(420)).toBe("420 m");
    expect(formatDistance(1240)).toBe("1.2 km");
  });
});

describe("parseCoords", () => {
  it("acepta coordenadas de México y las redondea a 3 decimales", () => {
    expect(parseCoords({ lat: "25.54321", lng: "-103.40987" })).toEqual({ lat: 25.543, lng: -103.41 });
  });

  it("rechaza lo que no es número o cae fuera de México", () => {
    expect(parseCoords({ lat: "abc", lng: "-103" })).toBeNull();
    expect(parseCoords({ lat: "40.7", lng: "-74" })).toBeNull();
    expect(parseCoords({})).toBeNull();
    expect(parseCoords(undefined)).toBeNull();
  });
});
