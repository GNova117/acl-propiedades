import { describe, expect, it } from "vitest";
import { NAV } from "./adminNav";
import { accessibleDestinations, fold, KEYWORDS, searchDestinations } from "./sectionSearch";

const all = () => true;
const LABELS = {
  "admin.infonavitSimulator": "Crédito Infonavit",
  "solicitudCredito.navTitle": "Solicitud de crédito",
  "accessControl.sections.gastos": "Desglose de gastos",
  "solicitudAvaluo.navTitle": "Solicitud de avalúo",
  "accessControl.sections.valuacion": "Estimación de valor",
  "sectionSearch.extra.expenseHistory": "Historial de gastos",
};
const labelOf = (d) => d.label || LABELS[d.labelKey] || d.labelKey;

describe("accessibleDestinations", () => {
  it("solo trae lo que el rol puede ver, igual que el menú", () => {
    const only = (...keys) => (s) => keys.includes(s);
    const paths = accessibleDestinations(NAV, only("gastos"), null).map((d) => d.to);
    expect(paths).toContain("/admin/gastos");
    expect(paths).toContain("/admin/gastos/historial");
    expect(paths).not.toContain("/admin/credito-infonavit");
    expect(paths).not.toContain("/admin/roles");
    // Los apartados sin permiso (inicio, ayuda, seguridad) los ve cualquiera; «Mi perfil» solo con un asesor vinculado.
    expect(paths).toContain("/admin/ayuda");
    expect(paths).not.toContain("/admin/mi-perfil");
    expect(accessibleDestinations(NAV, only("gastos"), 7).map((d) => d.to)).toContain("/admin/mi-perfil");
  });

  it("«Equipo hoy» no aparece para un asesor", () => {
    expect(accessibleDestinations(NAV, all, 3).map((d) => d.to)).not.toContain("/admin/equipo");
    expect(accessibleDestinations(NAV, all, null).map((d) => d.to)).toContain("/admin/equipo");
  });

  it("no repite destinos", () => {
    const paths = accessibleDestinations(NAV, all, null).map((d) => d.to);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("cada apartado del menú tiene palabras clave", () => {
    const paths = accessibleDestinations(NAV, all, 1).filter((d) => !d.to.endsWith("/nueva") && !d.to.endsWith("/nuevo")).map((d) => d.to);
    expect(paths.filter((to) => !KEYWORDS[to])).toEqual([]);
  });
});

describe("searchDestinations", () => {
  const dests = accessibleDestinations(NAV, all, null);
  const find = (q) => searchDestinations(dests, q, labelOf).map((d) => d.to);

  it("«crédito» encuentra todo lo que tiene que ver, incluso sin la palabra en el nombre", () => {
    const found = find("crédito");
    expect(found.slice(0, 2).sort()).toEqual(["/admin/credito-infonavit", "/admin/solicitud-credito"]);
    expect(found).toContain("/admin/solicitud-avaluo"); // el avalúo se pide para el crédito
  });

  it("sin acentos, mayúsculas ni plural", () => {
    expect(find("CREDITOS").slice(0, 2).sort()).toEqual(["/admin/credito-infonavit", "/admin/solicitud-credito"]);
    expect(find("Créditos")).toEqual(find("credito"));
  });

  it("«desglose de gastos» lleva a Gastos primero", () => {
    expect(find("desglose de gastos")[0]).toBe("/admin/gastos");
    expect(find("gastos")).toContain("/admin/gastos/historial");
  });

  it("varias palabras: todas deben coincidir", () => {
    expect(find("credito infonavit")[0]).toBe("/admin/credito-infonavit");
    expect(find("credito zzzz")).toEqual([]);
  });

  it("entiende sinónimos y palabras en inglés", () => {
    expect(find("hipoteca")).toContain("/admin/credito-infonavit");
    expect(find("mortgage")).toContain("/admin/credito-infonavit");
    expect(find("notario")).toContain("/admin/gastos");
  });

  it("lo que lleva la palabra en el nombre sale antes que lo que solo la tiene en palabras clave", () => {
    const found = find("avaluo");
    expect(found).toContain("/admin/valuacion"); // solo por palabra clave
    expect(found.indexOf("/admin/solicitud-avaluo")).toBeLessThan(found.indexOf("/admin/valuacion"));
  });

  it("búsqueda vacía o sin coincidencias → lista vacía", () => {
    expect(find("")).toEqual([]);
    expect(find("   ")).toEqual([]);
    expect(find("qwertyuiop")).toEqual([]);
  });

  it("fold quita acentos y pasa a minúsculas", () => {
    expect(fold("Crédito ÁÉÍÓÚ ñ")).toBe("credito aeiou n");
  });
});
