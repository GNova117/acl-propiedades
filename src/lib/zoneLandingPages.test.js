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

describe("páginas por colonia", () => {
  const zones = ["Torreón", "Torreón - Las Villas", "Torreón - Residencial del Parque", "Lerdo - Los Fresnos", "Colonia suelta"];

  it("separa ciudad y colonia, y la ciudad sola o una zona suelta no tienen colonia", async () => {
    const { splitColonyZone } = await import("./zoneLandingPages");
    expect(splitColonyZone("Torreón - Las Villas")).toEqual({ city: "Torreón", colony: "Las Villas" });
    expect(splitColonyZone("torreón - las villas")).toEqual({ city: "Torreón", colony: "las villas" });
    expect(splitColonyZone("Torreón")).toBeNull();
    expect(splitColonyZone("Torreón - ")).toBeNull();
    expect(splitColonyZone("Colonia suelta")).toBeNull();
    expect(splitColonyZone(null)).toBeNull();
  });

  it("arma la dirección con ciudad y colonia sin acentos", async () => {
    const { colonyPath } = await import("./zoneLandingPages");
    expect(colonyPath("Torreón - Residencial del Parque")).toBe("/propiedades/zona/torreon/residencial-del-parque");
    expect(colonyPath("Torreón")).toBeNull();
  });

  it("encuentra la zona del catálogo a partir de las dos partes de la dirección", async () => {
    const { findColonyZone } = await import("./zoneLandingPages");
    expect(findColonyZone(zones, "torreon", "las-villas")).toBe("Torreón - Las Villas");
    expect(findColonyZone(zones, "lerdo", "las-villas")).toBeNull();
    expect(findColonyZone(zones, "torreon", "no-existe")).toBeNull();
    expect(findColonyZone(zones, "torreon", "")).toBeNull();
  });

  it("lista solo las colonias con propiedades disponibles, de la que más tiene a la que menos", async () => {
    const { coloniesWithListings } = await import("./zoneLandingPages");
    const properties = [
      { zone: "Torreón - Las Villas", status: "disponible" },
      { zone: "Torreón - Las Villas", status: "disponible" },
      { zone: "Torreón - Residencial del Parque", status: "disponible" },
      { zone: "Torreón - Vendida", status: "vendida" },
      { zone: "Torreón - Inactiva", status: "disponible", active: false },
      { zone: "Torreón", status: "disponible" },
      { zone: "Lerdo - Los Fresnos", status: "disponible" },
    ];
    expect(coloniesWithListings(properties, "Torreón")).toEqual([
      { zone: "Torreón - Las Villas", colony: "Las Villas", count: 2, path: "/propiedades/zona/torreon/las-villas" },
      { zone: "Torreón - Residencial del Parque", colony: "Residencial del Parque", count: 1, path: "/propiedades/zona/torreon/residencial-del-parque" },
    ]);
  });
});
