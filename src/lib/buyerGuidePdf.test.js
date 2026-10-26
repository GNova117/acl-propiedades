import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { BUYER_GUIDE } from "./buyerGuide";
import { buildBuyerGuidePdf } from "./buyerGuidePdf";
import { COMPARE_DEFAULTS } from "./creditCompare";

const template = readFileSync(new URL("../../public/plantilla_acl.pdf", import.meta.url));

describe("BUYER_GUIDE", () => {
  it("usa los mismos valores de referencia que el comparador de créditos", () => {
    const text = JSON.stringify(BUYER_GUIDE);
    expect(text).toContain(`${COMPARE_DEFAULTS.bankDownPct}% del precio`);
    expect(text).toContain(`${COMPARE_DEFAULTS.closingCostsPct}% del precio`);
    expect(text).toContain("35%");
    expect(text).toContain("30%");
  });

  it("todas las secciones traen título y algún contenido", () => {
    for (const section of BUYER_GUIDE.sections) {
      expect(section.title).toBeTruthy();
      expect((section.paragraphs?.length || 0) + (section.bullets?.length || 0) + (section.numbered?.length || 0)).toBeGreaterThan(0);
    }
  });

  it("deja claro que es información de referencia y no una oferta de crédito", () => {
    expect(BUYER_GUIDE.disclaimer).toMatch(/no constituye asesor/i);
    expect(BUYER_GUIDE.disclaimer).toMatch(/oferta o aprobaci/i);
  });
});

describe("buildBuyerGuidePdf", () => {
  it("genera un PDF de varias páginas sobre la hoja membretada, con viñetas y acentos", async () => {
    const bytes = await buildBuyerGuidePdf({ template });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    const first = doc.getPages()[0];
    expect(first.getWidth()).toBe(612);
  });

  it("acepta un contenido más corto y no truena con listas vacías", async () => {
    const bytes = await buildBuyerGuidePdf({
      template,
      guide: { ...BUYER_GUIDE, sections: [{ title: "Solo título", paragraphs: ["Texto."] }], contact: [] },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
