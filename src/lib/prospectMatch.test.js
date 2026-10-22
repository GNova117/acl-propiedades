import { describe, expect, it } from "vitest";
import { criteriaSummary, hasCriteria, matchingProperties, matchingProspects } from "./prospectMatch";

const house = (over = {}) => ({ id: "h1", type: "casa", operation_type: "compra", zone: "Lerdo", price: 1500000, bedrooms: 3, status: "disponible", active: true, created_at: "2026-10-01", ...over });
const prospect = (over = {}) => ({ id: "p1", name: "Ana", stage: "interesado", search_criteria: { type: "casa", zone: "Lerdo", max_price: 1800000 }, ...over });

describe("hasCriteria", () => {
  it("es falso sin criterios, con objeto vacío o sin prospecto", () => {
    expect(hasCriteria(prospect({ search_criteria: null }))).toBe(false);
    expect(hasCriteria(prospect({ search_criteria: {} }))).toBe(false);
    expect(hasCriteria(undefined)).toBe(false);
  });
  it("es verdadero con al menos un criterio", () => {
    expect(hasCriteria(prospect())).toBe(true);
  });
});

describe("matchingProperties", () => {
  it("devuelve las propiedades disponibles que cumplen todos los criterios", () => {
    const list = [house(), house({ id: "h2", zone: "Gómez Palacio" }), house({ id: "h3", price: 2500000 }), house({ id: "h4", type: "departamento" })];
    expect(matchingProperties(prospect(), list).map((p) => p.id)).toEqual(["h1"]);
  });

  it("ignora propiedades vendidas, apartadas o inactivas", () => {
    const list = [house({ id: "a", status: "vendida" }), house({ id: "b", status: "apartada" }), house({ id: "c", active: false }), house({ id: "d" })];
    expect(matchingProperties(prospect(), list).map((p) => p.id)).toEqual(["d"]);
  });

  it("no incluye la propiedad por la que el prospecto ya preguntó", () => {
    expect(matchingProperties(prospect({ property_id: "h1" }), [house(), house({ id: "h2" })]).map((p) => p.id)).toEqual(["h2"]);
  });

  it("pone primero las más nuevas", () => {
    const list = [house({ id: "viejo", created_at: "2026-01-01" }), house({ id: "nuevo", created_at: "2026-10-10" }), house({ id: "medio", created_at: "2026-05-01" })];
    expect(matchingProperties(prospect(), list).map((p) => p.id)).toEqual(["nuevo", "medio", "viejo"]);
  });

  it("sin criterios o en etapa cerrada/perdida no sugiere nada", () => {
    expect(matchingProperties(prospect({ search_criteria: null }), [house()])).toEqual([]);
    expect(matchingProperties(prospect({ stage: "cerrado" }), [house()])).toEqual([]);
    expect(matchingProperties(prospect({ stage: "perdido" }), [house()])).toEqual([]);
  });

  it("aplica operación, recámaras mínimas y rango de presupuesto", () => {
    const p = prospect({ search_criteria: { operation_type: "renta", min_bedrooms: 3, min_price: 5000, max_price: 12000 } });
    const list = [
      house({ id: "ok", operation_type: "renta", price: 9000, bedrooms: 3 }),
      house({ id: "compra", operation_type: "compra", price: 9000 }),
      house({ id: "chica", operation_type: "renta", price: 9000, bedrooms: 2 }),
      house({ id: "cara", operation_type: "renta", price: 15000 }),
      house({ id: "barata", operation_type: "renta", price: 3000 }),
    ];
    expect(matchingProperties(p, list).map((x) => x.id)).toEqual(["ok"]);
  });
});

describe("zona: ciudad vs. colonia", () => {
  it("buscar una ciudad incluye sus colonias, y no otras ciudades", () => {
    const p = prospect({ search_criteria: { zone: "Torreón" } });
    const list = [house({ id: "ciudad", zone: "Torreón" }), house({ id: "colonia", zone: "Torreón - Las Villas" }), house({ id: "otra", zone: "Lerdo" }), house({ id: "calle", zone: "Lerdo - Carretera Torreón" })];
    expect(matchingProperties(p, list).map((x) => x.id).sort()).toEqual(["ciudad", "colonia"]);
  });

  it("buscar una colonia concreta solo compara esa colonia", () => {
    const p = prospect({ search_criteria: { zone: "Torreón - Las Villas" } });
    const list = [house({ id: "misma", zone: "Torreón - Las Villas" }), house({ id: "otra", zone: "Torreón - Moderna" }), house({ id: "ciudad", zone: "Torreón" })];
    expect(matchingProperties(p, list).map((x) => x.id)).toEqual(["misma"]);
  });

  it("la zona de ciudad se combina con el resto de criterios", () => {
    const p = prospect({ search_criteria: { zone: "Torreón", max_price: 1000000 } });
    const list = [house({ id: "barata", zone: "Torreón - Moderna", price: 900000 }), house({ id: "cara", zone: "Torreón - Moderna", price: 1500000 })];
    expect(matchingProperties(p, list).map((x) => x.id)).toEqual(["barata"]);
  });

  it("del lado de la propiedad también encuentra al prospecto que busca la ciudad", () => {
    const list = [prospect({ id: "ciudad", search_criteria: { zone: "Lerdo" } }), prospect({ id: "colonia", search_criteria: { zone: "Lerdo - Centro" } })];
    expect(matchingProspects(house({ zone: "Lerdo - Lerdo Centro" }), list).map((x) => x.id)).toEqual(["ciudad"]);
  });
});

describe("matchingProspects", () => {
  it("devuelve los prospectos abiertos con criterios a los que les encaja la propiedad", () => {
    const list = [
      prospect({ id: "ok" }),
      prospect({ id: "otraZona", search_criteria: { zone: "Torreón" } }),
      prospect({ id: "sinCriterios", search_criteria: null }),
      prospect({ id: "cerrado", stage: "cerrado" }),
      prospect({ id: "perdido", stage: "perdido" }),
    ];
    expect(matchingProspects(house(), list).map((p) => p.id)).toEqual(["ok"]);
  });

  it("una propiedad no disponible no tiene prospectos a quién avisar", () => {
    expect(matchingProspects(house({ status: "vendida" }), [prospect()])).toEqual([]);
    expect(matchingProspects(house({ active: false }), [prospect()])).toEqual([]);
  });

  it("no incluye a quien ya preguntó por esa misma propiedad", () => {
    expect(matchingProspects(house(), [prospect({ id: "ya", property_id: "h1" }), prospect({ id: "otro" })]).map((p) => p.id)).toEqual(["otro"]);
  });

  it("ordena por etapa más avanzada y luego por nombre", () => {
    const list = [
      prospect({ id: "nuevo", name: "Zoe", stage: "nuevo" }),
      prospect({ id: "neg", name: "Beto", stage: "negociacion" }),
      prospect({ id: "int2", name: "Carla", stage: "interesado" }),
      prospect({ id: "int1", name: "Abel", stage: "interesado" }),
    ];
    expect(matchingProspects(house(), list).map((p) => p.id)).toEqual(["neg", "int1", "int2", "nuevo"]);
  });
});

describe("criteriaSummary", () => {
  const t = (key) => ({ "alerts.criteria.type": "Tipo", "alerts.criteria.zone": "Zona", "alerts.criteria.price": "Precio", "alerts.criteria.operation": "Operación", "propertyOperation.renta": "Renta", "propertyType.casa": "Casa" })[key] ?? key;

  it("arma 'Etiqueta: valor' separado por puntos medios", () => {
    expect(criteriaSummary({ type: "casa", zone: "Lerdo", operation_type: "renta" }, t)).toBe("Tipo: Casa · Operación: Renta · Zona: Lerdo");
  });
  it("incluye el rango de precio con formato de moneda", () => {
    expect(criteriaSummary({ max_price: 1800000 }, t)).toMatch(/^Precio: ≤ \$1,800,000$/);
  });
  it("sin criterios devuelve texto vacío", () => {
    expect(criteriaSummary({}, t)).toBe("");
    expect(criteriaSummary(null, t)).toBe("");
  });
});
