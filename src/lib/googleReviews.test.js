import { describe, expect, it } from "vitest";
import { MAX_REVIEW_CHARS, parsePlaceResponse, pickReviews } from "./googleReviews";

const apiReview = (over = {}) => ({
  rating: 5,
  relativePublishTimeDescription: "hace 2 meses",
  text: { text: "Excelente atención, nos ayudaron con todo el trámite de crédito.", languageCode: "es" },
  authorAttribution: { displayName: "María López", uri: "https://maps.google.com/contrib/1", photoUri: "x" },
  ...over,
});

describe("parsePlaceResponse", () => {
  it("interpreta calificación, total, enlace y reseñas", () => {
    const parsed = parsePlaceResponse({ rating: 4.83, userRatingCount: 37, googleMapsUri: "https://maps.google.com/?cid=1", reviews: [apiReview()] });
    expect(parsed).toEqual({
      rating: 4.8,
      total: 37,
      url: "https://maps.google.com/?cid=1",
      reviews: [{ author: "María López", authorUrl: "https://maps.google.com/contrib/1", rating: 5, text: "Excelente atención, nos ayudaron con todo el trámite de crédito.", when: "hace 2 meses" }],
    });
  });

  it("devuelve null sin calificación (lugar sin reseñas o respuesta inesperada)", () => {
    expect(parsePlaceResponse({})).toBeNull();
    expect(parsePlaceResponse(null)).toBeNull();
    expect(parsePlaceResponse({ rating: 0 })).toBeNull();
  });

  it("descarta reseñas sin autor o sin calificación y no acepta enlaces que no sean https", () => {
    const parsed = parsePlaceResponse({ rating: 5, googleMapsUri: "javascript:alert(1)", reviews: [apiReview({ authorAttribution: {} }), apiReview({ rating: 0 }), apiReview()] });
    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.url).toBeNull();
  });

  it("tolera la falta de reseñas", () => {
    expect(parsePlaceResponse({ rating: 4.5, userRatingCount: 3 }).reviews).toEqual([]);
  });
});

describe("pickReviews", () => {
  const review = (over) => ({ author: "A", authorUrl: "", rating: 5, text: "Muy buena atención y acompañamiento en todo el proceso.", when: "", ...over });

  it("solo toma 4–5 estrellas con texto suficiente, hasta el máximo", () => {
    const list = [review({ rating: 3 }), review({ text: "Excelente" }), review({ author: "B" }), review({ author: "C", rating: 4 }), review({ author: "D" }), review({ author: "E" })];
    expect(pickReviews(list, 3).map((r) => r.author)).toEqual(["B", "C", "D"]);
  });

  it("recorta las reseñas muy largas sin cortar palabras", () => {
    const long = review({ text: "palabra ".repeat(100) });
    const [picked] = pickReviews([long]);
    expect(picked.text.length).toBeLessThanOrEqual(MAX_REVIEW_CHARS + 1);
    expect(picked.text.endsWith("…")).toBe(true);
    expect(picked.text).not.toMatch(/palab…$/);
  });

  it("no toca las reseñas cortas ni inventa nada con listas vacías", () => {
    expect(pickReviews([review()])[0].text).toBe("Muy buena atención y acompañamiento en todo el proceso.");
    expect(pickReviews(undefined)).toEqual([]);
  });
});
