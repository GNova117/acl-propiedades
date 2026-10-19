import { describe, expect, it } from "vitest";
import { prospectTemplates } from "./prospectTemplates";

// t de prueba: devuelve la clave y las variables, para verificar qué se pidió.
const t = (key, vars) => (vars ? `${key}|${JSON.stringify(vars)}` : key);
const house = { title: "Casa Los Álamos", price: 1850000 };
const keysOf = (list) => list.map((tpl) => tpl.key);
// Las variables van después del primer "|" (el valor de una variable puede traer otro).
const varsOf = (text) => JSON.parse(text.slice(text.indexOf("|") + 1));

describe("prospectTemplates", () => {
  it("el orden cambia con la etapa: lo más probable va primero", () => {
    expect(prospectTemplates(t, { name: "Ana", stage: "nuevo" }, { property: house })[0].key).toBe("first");
    expect(prospectTemplates(t, { name: "Ana", stage: "contactado" }, { property: house })[0].key).toBe("followup");
    expect(prospectTemplates(t, { name: "Ana", stage: "negociacion" }, { property: house })[0].key).toBe("offer");
    expect(prospectTemplates(t, { name: "Ana", stage: "perdido" }, { property: house })[0].key).toBe("reactivate");
  });

  it("'price' solo se ofrece si el prospecto tiene propiedad", () => {
    expect(keysOf(prospectTemplates(t, { name: "Ana", stage: "interesado" }, { property: house }))).toContain("price");
    expect(keysOf(prospectTemplates(t, { name: "Ana", stage: "interesado" }))).not.toContain("price");
  });

  it("rellena nombre de pila, propiedad, precio y asesor", () => {
    const price = prospectTemplates(t, { name: "  Ana María Pérez ", stage: "nuevo" }, { property: house, advisorName: "Luis" }).find((tpl) => tpl.key === "price");
    const vars = varsOf(price.text);
    expect(vars.name).toBe("Ana");
    expect(vars.property).toBe("Casa Los Álamos");
    expect(vars.advisor).toBe('prospects.templates.signedBy|{"advisor":"Luis"}');
    expect(vars.price).toMatch(/1,850,000/);
  });

  it("sin propiedad ni asesor usa los textos genéricos", () => {
    const first = prospectTemplates(t, { name: "Ana", stage: "nuevo" })[0];
    const vars = varsOf(first.text);
    expect(vars.property).toBe("prospects.templates.theSearch");
    expect(vars.advisor).toBe("prospects.templates.theAgency");
  });

  it("si el prospecto viene de una visita, 'después de la visita' va primero", () => {
    const list = prospectTemplates(t, { name: "Ana", stage: "contactado", visit_id: "v1" }, { property: house });
    expect(list[0].key).toBe("postVisit");
    expect(keysOf(list).filter((k) => k === "postVisit")).toHaveLength(1);
    // Cerrado no se reordena: ahí van los de posventa.
    expect(keysOf(prospectTemplates(t, { name: "Ana", stage: "cerrado", visit_id: "v1" }))).toEqual(["postsale30", "postsale180"]);
  });

  it("cerrado ofrece los mensajes de posventa de 1 mes y 6 meses", () => {
    const [month, six] = prospectTemplates(t, { name: "Ana Pérez", stage: "cerrado" }, { property: house });
    expect(month.text).toContain("Hola Ana");
    expect(month.text).toContain("un mes");
    expect(month.text).toContain("Casa Los Álamos");
    expect(six.text).toContain("seis meses");
  });
});
