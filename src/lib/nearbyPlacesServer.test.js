// La parte de servidor de "qué hay cerca" (server/nearbyPlaces.js y la ruta
// api/nearby-places.js) con un Overpass de mentira: no sale a la red.
import { describe, expect, it } from "vitest";
import { fetchNearbyPlaces, NearbyError } from "../../server/nearbyPlaces.js";
import handler from "../../api/nearby-places.js";

const LAT = 25.54;
const LNG = -103.4;
const okResponse = (elements) => ({ ok: true, status: 200, json: async () => ({ elements }) });
const school = { type: "node", lat: LAT + 0.002, lon: LNG, tags: { amenity: "school", name: "Primaria Benito Juárez" } };

describe("fetchNearbyPlaces", () => {
  it("manda la consulta por POST e interpreta la respuesta", async () => {
    let seen;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return okResponse([school]);
    };
    const places = await fetchNearbyPlaces({ lat: LAT, lng: LNG, fetchImpl, endpoints: ["https://a.test/api"] });
    expect(seen.url).toBe("https://a.test/api");
    expect(seen.init.method).toBe("POST");
    expect(decodeURIComponent(seen.init.body)).toContain("around:1500");
    expect(seen.init.headers["User-Agent"]).toContain("acl-propiedades");
    expect(places.schools.count).toBe(1);
  });

  it("si el primer servidor falla, prueba con el siguiente", async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return url.includes("a.test") ? { ok: false, status: 504 } : okResponse([school]);
    };
    const places = await fetchNearbyPlaces({ lat: LAT, lng: LNG, fetchImpl, endpoints: ["https://a.test", "https://b.test"] });
    expect(calls).toEqual(["https://a.test", "https://b.test"]);
    expect(places.schools.count).toBe(1);
  });

  it("si todos fallan, lanza un NearbyError con el código", async () => {
    const fetchImpl = async () => ({ ok: false, status: 429 });
    await expect(fetchNearbyPlaces({ lat: LAT, lng: LNG, fetchImpl, endpoints: ["https://a.test"] })).rejects.toMatchObject({ code: "rate_limited" });
    const badBody = async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) });
    await expect(fetchNearbyPlaces({ lat: LAT, lng: LNG, fetchImpl: badBody, endpoints: ["https://a.test"] })).rejects.toBeInstanceOf(NearbyError);
  });
});

function fakeRes() {
  const res = { headers: {}, statusCode: null, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

describe("api/nearby-places", () => {
  it("rechaza otros métodos y coordenadas inválidas", async () => {
    const post = fakeRes();
    await handler({ method: "POST", query: {} }, post);
    expect(post.statusCode).toBe(405);

    const bad = fakeRes();
    await handler({ method: "GET", query: { lat: "40", lng: "-74" } }, bad);
    expect(bad.statusCode).toBe(400);
    expect(bad.headers["Cache-Control"]).toBe("no-store");
  });
});
