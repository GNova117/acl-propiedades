import { describe, expect, it } from "vitest";
import { surveyOutcome } from "./visitSurvey";

const URL = "https://search.google.com/local/writereview?placeid=ABC123";

describe("surveyOutcome", () => {
  it("invita a reseñar en Google solo con 4 o 5 y con un enlace configurado", () => {
    expect(surveyOutcome(5, { googleReviewUrl: URL }).invite).toBe(true);
    expect(surveyOutcome(4, { googleReviewUrl: URL }).invite).toBe(true);
    expect(surveyOutcome(3, { googleReviewUrl: URL }).invite).toBe(false);
    expect(surveyOutcome(1, { googleReviewUrl: URL }).invite).toBe(false);
  });

  it("sin enlace configurado no hay invitación, aunque califique 5", () => {
    expect(surveyOutcome(5).invite).toBe(false);
    expect(surveyOutcome(5, { googleReviewUrl: "" }).invite).toBe(false);
  });

  it("no acepta un enlace que no sea https (nada de javascript: ni http)", () => {
    for (const bad of ["javascript:alert(1)", "http://x.com", "ftp://x.com", "no es una url", "https://con espacio"]) {
      expect(surveyOutcome(5, { googleReviewUrl: bad }).invite).toBe(false);
    }
  });
});
