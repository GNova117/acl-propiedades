import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_DESCRIPTION, HOME_TITLE } from "./siteCopy";
import es from "../i18n/locales/es.json";

const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

describe("el texto del inicio es el mismo en index.html, el inicio y las vistas previas", () => {
  it("index.html", () => {
    expect(indexHtml).toContain(`<meta name="description" content="${HOME_DESCRIPTION}" />`);
    expect(indexHtml).toContain(`<title>${HOME_TITLE}</title>`);
  });
  it("el español del inicio", () => {
    expect(es.home.seoDescription).toBe(HOME_DESCRIPTION);
    expect(es.home.seoTitle).toBe(HOME_TITLE);
  });
  it("no anuncia naves industriales mientras ese apartado esté en «Próximamente»", () => {
    expect(HOME_DESCRIPTION.toLowerCase()).not.toContain("naves");
  });
});
