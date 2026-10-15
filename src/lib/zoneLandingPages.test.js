import { describe, expect, it } from "vitest";
import { findCityBySlug, propertyMatchesCity, slugify, ZONE_LANDING_CITIES } from "./zoneLandingPages";

describe("slugify", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(slugify("Torreón")).toBe("torreon");
    expect(slugify("Gómez Palacio")).toBe("gomez-palacio");
  });

  it("colapsa separadores y recorta guiones en los extremos", () => {
    expect(slugify("  Lerdo!!  ")).toBe("lerdo");
  });

  it("devuelve cadena vacía para valores vacíos o nulos", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
  });
});

describe("findCityBySlug", () => {
  it("encuentra la ciudad a partir de su slug", () => {
    expect(findCityBySlug("torreon")).toBe("Torreón");
    expect(findCityBySlug("gomez-palacio")).toBe("Gómez Palacio");
  });

  it("devuelve null si no hay coincidencia", () => {
    expect(findCityBySlug("ciudad-inexistente")).toBeNull();
  });

  it("solo contiene las ciudades esperadas", () => {
    expect(ZONE_LANDING_CITIES).toEqual(["Torreón", "Gómez Palacio", "Lerdo"]);
  });
});

describe("propertyMatchesCity", () => {
  it("coincide cuando la zona es exactamente la ciudad", () => {
    expect(propertyMatchesCity({ zone: "Torreón" }, "Torreón")).toBe(true);
  });

  it("coincide cuando la zona es una colonia de esa ciudad (\"Ciudad - Colonia\")", () => {
    expect(propertyMatchesCity({ zone: "Torreón - Las Villas" }, "Torreón")).toBe(true);
  });

  it("no coincide con una colonia de otra ciudad", () => {
    expect(propertyMatchesCity({ zone: "Lerdo - Los Fresnos" }, "Torreón")).toBe(false);
  });

  it("no se deja engañar por una dirección que solo menciona la ciudad de pasada", () => {
    // Caso real detectado en pruebas: una nave en Lerdo con dirección
    // "Carretera Lerdo-Torreón" no debe aparecer en la página de Torreón.
    expect(propertyMatchesCity({ zone: "Lerdo", address: "Carretera Lerdo-Torreón, Lerdo, Durango" }, "Torreón")).toBe(false);
  });

  it("es insensible a mayúsculas/minúsculas", () => {
    expect(propertyMatchesCity({ zone: "torreón" }, "Torreón")).toBe(true);
  });

  it("devuelve false sin propiedad, sin ciudad o sin zona", () => {
    expect(propertyMatchesCity(null, "Torreón")).toBe(false);
    expect(propertyMatchesCity({ zone: "Torreón" }, "")).toBe(false);
    expect(propertyMatchesCity({ zone: "" }, "Torreón")).toBe(false);
  });
});
