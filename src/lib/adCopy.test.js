import { describe, expect, it } from "vitest";
import { adFacts, factIssue, finalizeVariants, mentionedPrices, withFooter } from "./adCopy";

const property = {
  id: "7",
  title: "Casa en Residencial Senderos",
  type: "casa",
  description: "Casa de dos plantas con 180 m² de construcción y jardín.",
  price: 2450000,
  area_m2: 180,
  bedrooms: 3,
  bathrooms: 2.5,
  parking: 2,
  zone: "Torreón",
  address: "Residencial Senderos, Torreón",
  operation_type: "venta",
  amenities: ["alberca", "seguridad_24h"],
};
const origin = "https://acl.mx";

describe("adFacts", () => {
  it("entrega solo lo que existe y humaniza las amenidades", () => {
    const facts = adFacts({ ...property, parking: null, bathrooms: "" });
    expect(facts).toMatchObject({ tipo: "casa", operacion: "venta", precio_mxn: 2450000, recamaras: 3, amenidades: ["alberca", "seguridad 24h"] });
    expect(facts).not.toHaveProperty("estacionamientos");
    expect(facts).not.toHaveProperty("banos");
  });
  it("no deja pasar saltos de línea ni comillas invertidas de la descripción al prompt", () => {
    expect(adFacts({ ...property, description: "uno\n```dos" }).descripcion).toBe("uno dos");
  });
});

describe("mentionedPrices", () => {
  it.each([
    ["Solo $2,450,000 MXN", [2450000]],
    ["desde $2.45 millones", [2450000]],
    ["por $850 mil", [850000]],
    ["2.4 mdp", [2400000]],
    ["$1,500 al mes", [1500]],
    ["sin precios aquí", []],
  ])("%j", (text, expected) => expect(mentionedPrices(text)).toEqual(expected));
});

describe("factIssue", () => {
  it("acepta un texto fiel a la ficha", () => {
    expect(factIssue("3 recámaras, 2.5 baños y 180 m² por $2,450,000. Alberca incluida.", property)).toBeNull();
    expect(factIssue("Por $2.45 millones, con 2 baños y medio", property)).toBeNull();
  });
  it("rechaza un precio distinto, aunque sea parecido", () => {
    expect(factIssue("Por solo $2,200,000", property)).toBe("price");
    expect(factIssue("Por solo $2.2 millones", property)).toBe("price");
  });
  it("rechaza recámaras, baños o superficie que no están en la ficha", () => {
    expect(factIssue("4 recámaras amplias", property)).toBe("bedrooms");
    expect(factIssue("4 baños completos", property)).toBe("bathrooms");
    expect(factIssue("con 250 m² de construcción", property)).toBe("area");
  });
  it("una recámara mencionada cuando la ficha no trae recámaras se descarta", () => {
    expect(factIssue("2 recámaras", { ...property, bedrooms: null })).toBe("bedrooms");
  });
  it("rechaza enlaces y teléfonos escritos por el modelo", () => {
    expect(factIssue("Míralo en https://ejemplo.com/casa", property)).toBe("link");
    expect(factIssue("Escríbeme al 871 324 3271", property)).toBe("phone");
    expect(factIssue("Llama al 8713243271", property)).toBe("phone");
  });
  it("un monto con comas no se confunde con un teléfono", () => {
    expect(factIssue("Cuesta $2,450,000 y tiene 3 recámaras", property)).toBeNull();
  });
  it("sin precio en la ficha, cualquier precio mencionado es inventado", () => {
    expect(factIssue("Cuesta $1,000,000", { ...property, price: null })).toBe("price");
  });
});

describe("finalizeVariants", () => {
  const good = "Hay casas que se sienten hogar desde la entrada. Esta tiene 3 recámaras y alberca en Residencial Senderos.";
  it("conserva las buenas, descarta las que contradicen la ficha y agrega el enlace al final", () => {
    const { variants, discarded } = finalizeVariants(
      [{ angle: "hogar", text: good }, { angle: "falsa", text: "Casa de 5 recámaras con alberca en Residencial Senderos, no te la pierdas." }, { text: "corto" }, null],
      property,
      { channel: "whatsapp", origin }
    );
    expect(variants).toHaveLength(1);
    expect(discarded).toBe(3);
    expect(variants[0].angle).toBe("hogar");
    expect(variants[0].text.endsWith("🔗 https://acl.mx/propiedades/7")).toBe(true);
  });
  it("devuelve vacío si lo recibido no es una lista", () => {
    expect(finalizeVariants({ nope: true }, property, { channel: "portal", origin })).toEqual({ variants: [], discarded: 0 });
  });
});

describe("withFooter", () => {
  it("whatsapp: enlace; facebook: enlace y contacto; instagram: solo contacto; portal: nada", () => {
    expect(withFooter("x", property, { channel: "whatsapp", origin })).toContain("https://acl.mx/propiedades/7");
    const fb = withFooter("x", property, { channel: "facebook", origin });
    expect(fb).toContain("https://acl.mx/propiedades/7");
    expect(fb).toContain("871 324 3271");
    const ig = withFooter("x", property, { channel: "instagram", origin });
    expect(ig).not.toContain("https://");
    expect(ig).toContain("871 324 3271");
    expect(withFooter("x", property, { channel: "portal", origin })).toBe("x");
  });
});
