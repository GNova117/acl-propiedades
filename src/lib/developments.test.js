import { describe, it, expect } from "vitest";
import {
  parseUnitsCsv,
  unitsToCsv,
  parsePrice,
  normalizeUnitStatus,
  developmentStats,
  modelStats,
  groupUnitsByFloor,
  filterUnits,
  resolveUnit,
  unitWhatsappText,
  validateDevelopment,
  developmentSlug,
  resolveDevelopmentMedia,
  buildDevelopmentPayload,
  EMPTY_UNIT_FILTERS,
} from "./developments";

const MODELS = [
  { key: "a", name: "Modelo A", area_m2: 62, bedrooms: 1, bathrooms: 1, parking: 1, images: ["a.jpg"] },
  { key: "b", name: "Modelo B", area_m2: 88, bedrooms: 2, bathrooms: 2, parking: 2, images: ["b.jpg"] },
];

const DEV = {
  name: "Torre Aurora",
  models: MODELS,
  units: [
    { number: "101", floor: 1, model: "a", price: 1800000, status: "vendida", view: "Norte" },
    { number: "102", floor: 1, model: "b", price: 2500000, status: "disponible", view: "Sur" },
    { number: "201", floor: 2, model: "a", price: 1850000, status: "disponible", view: "Norte" },
    { number: "202", floor: 2, model: "b", price: 2550000, status: "apartada", view: "Sur" },
    { number: "301", floor: 3, model: "a", price: 1900000, status: "disponible", view: "Norte" },
  ],
};

describe("parsePrice", () => {
  it("acepta símbolo de pesos, comas y decimales", () => {
    expect(parsePrice("$1,850,000")).toBe(1850000);
    expect(parsePrice("2500000.50")).toBe(2500000.5);
  });
  it("rechaza vacío, texto y cero", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("mucho")).toBeNull();
    expect(parsePrice("0")).toBeNull();
  });
});

describe("normalizeUnitStatus", () => {
  it("entiende masculino, femenino y mayúsculas", () => {
    expect(normalizeUnitStatus("Apartado")).toBe("apartada");
    expect(normalizeUnitStatus(" VENDIDO ")).toBe("vendida");
    expect(normalizeUnitStatus("Disponible")).toBe("disponible");
    expect(normalizeUnitStatus("rentado")).toBeNull();
  });
});

describe("parseUnitsCsv", () => {
  it("lee encabezados en cualquier orden y acepta el nombre o la clave del modelo", () => {
    const text = "piso,numero,modelo,estatus,precio\n1,101,Modelo A,vendido,1800000\n2,201,b,disponible,2550000";
    const { units, errors } = parseUnitsCsv(text, MODELS);
    expect(errors).toEqual([]);
    expect(units).toEqual([
      { number: "101", floor: 1, model: "a", price: 1800000, status: "vendida", view: "" },
      { number: "201", floor: 2, model: "b", price: 2550000, status: "disponible", view: "" },
    ]);
  });

  it("sin encabezados usa el orden número, piso, modelo, precio, estatus, vista", () => {
    const { units, errors } = parseUnitsCsv("301;3;a;1900000;apartada;Poniente", MODELS);
    expect(errors).toEqual([]);
    expect(units[0]).toMatchObject({ number: "301", floor: 3, status: "apartada", view: "Poniente" });
  });

  it("acepta pegado desde Excel (tabuladores) y precios con comas entre comillas", () => {
    const { units } = parseUnitsCsv("101\t1\ta\t$1,800,000\tdisponible", MODELS);
    expect(units[0].price).toBe(1800000);
    const quoted = parseUnitsCsv('numero,piso,modelo,precio\n101,1,a,"1,800,000"', MODELS);
    expect(quoted.units[0].price).toBe(1800000);
  });

  it("estatus vacío cuenta como disponible", () => {
    const { units } = parseUnitsCsv("numero,piso,modelo,precio\n101,1,a,1800000", MODELS);
    expect(units[0].status).toBe("disponible");
  });

  it("reporta cada fila mala con su número de línea y conserva las buenas", () => {
    const text = [
      "numero,piso,modelo,precio,estatus",
      "101,1,a,1800000,disponible",
      "101,1,a,1800000,disponible",
      "102,x,a,1800000,disponible",
      "103,1,zzz,1800000,disponible",
      "104,1,a,gratis,disponible",
      "105,1,a,1800000,regalado",
      ",1,a,1800000,disponible",
    ].join("\n");
    const { units, errors } = parseUnitsCsv(text, MODELS);
    expect(units.map((u) => u.number)).toEqual(["101"]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(errors[0].message).toMatch(/repetido/);
    expect(errors[2].message).toMatch(/modelo/);
  });

  it("texto vacío no es error", () => {
    expect(parseUnitsCsv("  \n ", MODELS)).toEqual({ units: [], errors: [] });
  });
});

describe("unitsToCsv", () => {
  it("exporta algo que parseUnitsCsv vuelve a leer igual", () => {
    const csv = unitsToCsv(DEV.units, MODELS);
    const { units, errors } = parseUnitsCsv(csv, MODELS);
    expect(errors).toEqual([]);
    expect(units).toEqual(DEV.units);
  });
});

describe("developmentStats", () => {
  it("cuenta por estatus y toma el precio inicial solo de los disponibles", () => {
    const stats = developmentStats(DEV);
    expect(stats).toMatchObject({ total: 5, available: 3, reserved: 1, sold: 1, fromPrice: 1850000, toPrice: 2500000, floors: 3 });
  });
  it("rangos de m² y recámaras salen de los modelos en uso", () => {
    const stats = developmentStats(DEV);
    expect(stats).toMatchObject({ minArea: 62, maxArea: 88, minBedrooms: 1, maxBedrooms: 2 });
  });
  it("una torre sin departamentos no truena", () => {
    expect(developmentStats({ models: MODELS, units: [] })).toMatchObject({ total: 0, fromPrice: null, floors: 0 });
  });
});

describe("modelStats", () => {
  it("cuántos quedan y desde cuánto, por modelo", () => {
    const [a, b] = modelStats(DEV);
    expect(a).toMatchObject({ total: 3, available: 2, fromPrice: 1850000 });
    expect(b).toMatchObject({ total: 2, available: 1, fromPrice: 2500000 });
  });
});

describe("groupUnitsByFloor", () => {
  it("el piso más alto primero y los deptos en orden numérico", () => {
    const grouped = groupUnitsByFloor([...DEV.units].reverse());
    expect(grouped.map((g) => g.floor)).toEqual([3, 2, 1]);
    expect(grouped[2].units.map((u) => u.number)).toEqual(["101", "102"]);
  });
});

describe("resolveUnit", () => {
  it("hereda m², recámaras y fotos del modelo", () => {
    const unit = resolveUnit(DEV, DEV.units[1]);
    expect(unit).toMatchObject({ area_m2: 88, bedrooms: 2, model_name: "Modelo B", images: ["b.jpg"], type: "departamento" });
  });
});

describe("filterUnits", () => {
  it("por defecto solo muestra disponibles, del piso más alto al más bajo", () => {
    expect(filterUnits(DEV).map((u) => u.number)).toEqual(["301", "201", "102"]);
  });
  it("combina modelo, recámaras, piso mínimo y presupuesto", () => {
    expect(filterUnits(DEV, { ...EMPTY_UNIT_FILTERS, status: "", model: "b" }).map((u) => u.number)).toEqual(["202", "102"]);
    expect(filterUnits(DEV, { ...EMPTY_UNIT_FILTERS, bedrooms: "2" }).map((u) => u.number)).toEqual(["102"]);
    expect(filterUnits(DEV, { ...EMPTY_UNIT_FILTERS, floorFrom: "3" }).map((u) => u.number)).toEqual(["301"]);
    expect(filterUnits(DEV, { ...EMPTY_UNIT_FILTERS, maxPrice: "1900000" }).map((u) => u.number)).toEqual(["301", "201"]);
  });
  it("ordena por precio", () => {
    expect(filterUnits(DEV, { ...EMPTY_UNIT_FILTERS, sortBy: "price_asc" }).map((u) => u.number)).toEqual(["201", "301", "102"]);
  });
  it("estatus vacío trae todos", () => {
    expect(filterUnits(DEV, { ...EMPTY_UNIT_FILTERS, status: "" })).toHaveLength(5);
  });
});

describe("unitWhatsappText", () => {
  it("menciona torre, depto, piso y modelo", () => {
    const text = unitWhatsappText(DEV, resolveUnit(DEV, DEV.units[1]), "https://x.test/d");
    expect(text).toContain("departamento 102");
    expect(text).toContain("piso 1");
    expect(text).toContain("Modelo B");
    expect(text).toContain("Torre Aurora");
    expect(text.endsWith("https://x.test/d")).toBe(true);
  });
});

describe("validateDevelopment", () => {
  const ok = { name: "Torre", developer_name: "Desarrolladora", zone: "Torreón", models: MODELS, units: DEV.units };
  it("sin errores cuando todo está completo", () => {
    expect(validateDevelopment(ok)).toEqual({});
  });
  it("exige nombre, desarrollador y zona", () => {
    expect(validateDevelopment({ ...ok, name: " ", developer_name: "", zone: "" })).toEqual({
      name: "required",
      developer_name: "required",
      zone: "required",
    });
  });
  it("detecta modelos incompletos o repetidos y deptos con modelo inexistente", () => {
    expect(validateDevelopment({ ...ok, models: [{ key: "a", name: "" }] }).models).toBe("modelIncomplete");
    expect(validateDevelopment({ ...ok, models: [MODELS[0], MODELS[0]] }).models).toBe("modelDuplicate");
    expect(validateDevelopment({ ...ok, models: [MODELS[0]] }).units).toBe("unitModelMissing");
  });
});

describe("developmentSlug", () => {
  it("minúsculas, sin acentos y con guiones", () => {
    expect(developmentSlug("Torre Aurora")).toBe("torre-aurora");
    expect(developmentSlug("  Residencial Ámbar  II ")).toBe("residencial-ambar-ii");
    expect(developmentSlug("***")).toBe("desarrollo");
  });
});

describe("resolveDevelopmentMedia", () => {
  const upload = async (files) => files.map((f) => `up:${f}`);
  it("junta fotos existentes con las nuevas, en orden, por torre y por modelo", async () => {
    const media = await resolveDevelopmentMedia(
      {
        heroFile: "hero.jpg",
        existingImages: ["old1"],
        imageFiles: ["new1", "new2"],
        models: [
          { key: "a", existingImages: ["a-old"], imageFiles: ["a-new"], planFile: "plan.png" },
          { key: "b", existingImages: [], imageFiles: [], existingPlan: "b-plan" },
        ],
      },
      upload
    );
    expect(media.hero_image).toBe("up:hero.jpg");
    expect(media.images).toEqual(["old1", "up:new1", "up:new2"]);
    expect(media.models.a).toEqual({ images: ["a-old", "up:a-new"], plan_image: "up:plan.png" });
    expect(media.models.b).toEqual({ images: [], plan_image: "b-plan" });
  });
  it("sin portada propia usa la primera foto de la galería", async () => {
    const media = await resolveDevelopmentMedia({ existingImages: ["g1", "g2"], models: [] }, upload);
    expect(media.hero_image).toBe("g1");
  });
});

describe("buildDevelopmentPayload", () => {
  it("recorta textos, convierte números y descarta amenidades vacías", () => {
    const payload = buildDevelopmentPayload(
      {
        name: "  Torre Aurora ",
        zone: "Torreón",
        developer_name: " Grupo X ",
        stage: "inventada",
        lat: "25.5",
        lng: "",
        amenities: [" Alberca ", "", "Gimnasio"],
        models: [{ key: "a", name: " A ", area_m2: "62", bedrooms: "1", bathrooms: "", parking: "" }],
        units: [{ number: 101, floor: "1", model: "a", price: "1800000", status: "disponible" }],
        published: 1,
      },
      { hero_image: "h", developer_logo: "", images: ["g"], models: { a: { images: ["m"], plan_image: "" } } }
    );
    expect(payload).toMatchObject({
      name: "Torre Aurora",
      developer_name: "Grupo X",
      stage: "preventa",
      lat: 25.5,
      lng: null,
      amenities: ["Alberca", "Gimnasio"],
      published: true,
      developer_logo: null,
    });
    expect(payload.models[0]).toMatchObject({ name: "A", area_m2: 62, bedrooms: 1, bathrooms: null, images: ["m"], plan_image: null });
    expect(payload.units[0]).toEqual({ number: "101", floor: 1, model: "a", price: 1800000, status: "disponible", view: "" });
  });
});
