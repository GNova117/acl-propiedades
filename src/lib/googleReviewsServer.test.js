// La parte de servidor de las reseñas de Google (server/googleReviews.js y la
// ruta api/google-reviews.js) con un Google de mentira: no sale a la red.
import { afterEach, describe, expect, it } from "vitest";
import { fetchPlaceReviews } from "../../server/googleReviews.js";
import handler from "../../api/google-reviews.js";

const okJson = (json) => ({ ok: true, status: 200, json: async () => json });
const place = { rating: 4.8, userRatingCount: 12, googleMapsUri: "https://maps.google.com/?cid=1", reviews: [] };

describe("fetchPlaceReviews", () => {
  it("manda la llave y el FieldMask por encabezado (no en la URL) y devuelve los datos", async () => {
    let seen;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return okJson(place);
    };
    const result = await fetchPlaceReviews({ apiKey: "KEY", placeId: "ChIJabc123", fetchImpl });
    expect(seen.url).toBe("https://places.googleapis.com/v1/places/ChIJabc123?languageCode=es");
    expect(seen.url).not.toContain("KEY");
    expect(seen.init.headers["X-Goog-Api-Key"]).toBe("KEY");
    expect(seen.init.headers["X-Goog-FieldMask"]).toContain("reviews");
    expect(result.rating).toBe(4.8);
  });

  it("traduce los errores de Google a códigos", async () => {
    const codeFor = (status) => fetchPlaceReviews({ apiKey: "K", placeId: "P", fetchImpl: async () => ({ ok: false, status }) }).catch((e) => e.code);
    expect(await codeFor(403)).toBe("bad_key");
    expect(await codeFor(404)).toBe("not_found");
    expect(await codeFor(429)).toBe("rate_limited");
    expect(await codeFor(500)).toBe("upstream");
  });

  it("falla con un código claro si falta la configuración o el lugar no tiene calificación", async () => {
    await expect(fetchPlaceReviews({})).rejects.toMatchObject({ code: "bad_key" });
    await expect(fetchPlaceReviews({ apiKey: "K", placeId: "P", fetchImpl: async () => okJson({}) })).rejects.toMatchObject({ code: "no_data" });
  });
});

function fakeRes() {
  const res = { headers: {}, statusCode: null, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

describe("api/google-reviews", () => {
  afterEach(() => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACE_ID;
  });

  it("sin configuración responde configured:false y no cachea", async () => {
    const res = fakeRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ configured: false });
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("rechaza otros métodos", async () => {
    const res = fakeRes();
    await handler({ method: "POST" }, res);
    expect(res.statusCode).toBe(405);
  });
});
