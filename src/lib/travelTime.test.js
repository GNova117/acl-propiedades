import { describe, expect, it, vi } from "vitest";
import { estimateDrivingMinutes, formatDuration, haversineKm, readSavedPlace, roundMinutes, savePlace, shortPlaceLabel, travelTimeBetween } from "./travelTime";

const centro = { lat: 25.5428, lng: -103.4068 };
const lerdo = { lat: 25.5361, lng: -103.5297 };

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
};

describe("distancia y estimación", () => {
  it("la distancia en línea recta es razonable (Torreón–Lerdo ≈ 12 km)", () => {
    const km = haversineKm(centro, lerdo);
    expect(km).toBeGreaterThan(11);
    expect(km).toBeLessThan(14);
    expect(haversineKm(centro, centro)).toBe(0);
  });
  it("la estimación sube con la distancia y nunca baja de 1 minuto", () => {
    expect(estimateDrivingMinutes(0)).toBe(1);
    expect(estimateDrivingMinutes(10)).toBeGreaterThan(estimateDrivingMinutes(5));
    expect(estimateDrivingMinutes(12)).toBeGreaterThan(20);
    expect(estimateDrivingMinutes(12)).toBeLessThan(40);
  });
  it("se redondea de 5 en 5 a partir de 10 min y se parte en horas", () => {
    expect(roundMinutes(7.4)).toBe(7);
    expect(roundMinutes(23)).toBe(25);
    expect(roundMinutes(0.2)).toBe(1);
    expect(formatDuration(42)).toEqual({ hours: 0, minutes: 40 });
    expect(formatDuration(78)).toEqual({ hours: 1, minutes: 20 });
  });
});

describe("travelTimeBetween", () => {
  it("usa la ruta real cuando el servicio contesta", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ code: "Ok", routes: [{ duration: 1260, distance: 14500 }] }) }));
    const result = await travelTimeBetween(centro, lerdo, { fetchImpl });
    expect(result).toEqual({ minutes: 21, km: 14.5, source: "route" });
    expect(fetchImpl.mock.calls[0][0]).toContain("-103.4068,25.5428;-103.5297,25.5361");
  });
  it("si el servicio falla, responde mal o tarda de más, cae en la estimación", async () => {
    for (const fetchImpl of [
      async () => {
        throw new Error("sin red");
      },
      async () => ({ ok: false }),
      async () => ({ ok: true, json: async () => ({ code: "NoRoute", routes: [] }) }),
      async () => ({ ok: true, json: async () => ({ code: "Ok", routes: [{ duration: "x", distance: 1 }] }) }),
      (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("abortado")))),
    ]) {
      const result = await travelTimeBetween(centro, lerdo, { fetchImpl, timeoutMs: 20 });
      expect(result.source).toBe("estimate");
      expect(result.minutes).toBeGreaterThan(10);
    }
  });
});

describe("lugar recordado", () => {
  it("se guarda, se lee y se quita", () => {
    const storage = memoryStorage();
    expect(readSavedPlace(storage)).toBeNull();
    savePlace({ label: "Mi trabajo", lat: 25.5, lng: -103.4, extra: "no se guarda" }, storage);
    expect(readSavedPlace(storage)).toEqual({ label: "Mi trabajo", lat: 25.5, lng: -103.4 });
    savePlace(null, storage);
    expect(readSavedPlace(storage)).toBeNull();
  });
  it("ignora datos dañados", () => {
    const storage = memoryStorage();
    storage.setItem("acl_travel_place", "{no es json");
    expect(readSavedPlace(storage)).toBeNull();
    storage.setItem("acl_travel_place", JSON.stringify({ label: "x", lat: "a", lng: 1 }));
    expect(readSavedPlace(storage)).toBeNull();
  });
  it("acorta los nombres largos de Nominatim", () => {
    expect(shortPlaceLabel("Parque Industrial, Gómez Palacio, Durango, 35000, México")).toBe("Parque Industrial, Gómez Palacio, Durango");
    expect(shortPlaceLabel(null)).toBe("");
  });
});
