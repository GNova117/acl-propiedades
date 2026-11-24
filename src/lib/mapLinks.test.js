import { describe, expect, it } from "vitest";
import { directionsUrl, hasCoordinates, streetViewUrl, wazeUrl } from "./mapLinks";

const property = { lat: 25.5428, lng: -103.4068 };

describe("enlaces de mapa", () => {
  it("indicaciones hasta el punto exacto", () => {
    const url = directionsUrl(property);
    expect(url).toContain("destination=25.5428%2C-103.4068");
    expect(url.startsWith("https://www.google.com/maps/dir/")).toBe(true);
  });
  it("street view y waze apuntan al mismo punto", () => {
    expect(streetViewUrl(property)).toContain("map_action=pano");
    expect(streetViewUrl(property)).toContain("viewpoint=25.5428%2C-103.4068");
    expect(wazeUrl(property)).toContain("ll=25.5428%2C-103.4068");
  });
  it("sin coordenadas creíbles no hay enlaces", () => {
    for (const bad of [{}, { lat: null, lng: null }, { lat: 0, lng: 0 }, { lat: 200, lng: 10 }, { lat: "x", lng: 1 }]) {
      expect(hasCoordinates(bad)).toBe(false);
      expect(directionsUrl(bad)).toBeNull();
      expect(streetViewUrl(bad)).toBeNull();
      expect(wazeUrl(bad)).toBeNull();
    }
  });
});
