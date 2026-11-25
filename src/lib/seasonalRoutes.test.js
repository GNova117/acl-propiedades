import { describe, expect, it } from "vitest";
import { showsSeasonalParticles } from "./seasonalRoutes";

describe("showsSeasonalParticles", () => {
  it("salen en el sitio público", () => {
    for (const path of ["/", "/propiedades", "/propiedades/casa-en-x-ACL-1001", "/blog", "/contacto"]) expect(showsSeasonalParticles(path)).toBe(true);
  });
  it("no salen en el panel ni en enlaces privados", () => {
    for (const path of ["/admin", "/admin/clientes", "/informe/abc", "/firmar/abc", "/documentos/abc", "/visita/abc", "/opinion/abc", "/seleccion/abc", "/registro/abc"]) {
      expect(showsSeasonalParticles(path)).toBe(false);
    }
  });
  it("no confunde rutas parecidas", () => {
    expect(showsSeasonalParticles("/administracion")).toBe(true);
    expect(showsSeasonalParticles("/registrarse")).toBe(true);
  });
});
