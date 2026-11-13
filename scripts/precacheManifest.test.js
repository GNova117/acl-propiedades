import { describe, expect, it } from "vitest";
import { buildPrecacheManifest, precacheManifestPlugin } from "./precacheManifest.js";

const chunk = (fileName, modules = [], imports = []) => ({
  type: "chunk",
  fileName,
  modules: Object.fromEntries(modules.map((id) => [id, {}])),
  imports,
});
const asset = (fileName) => ({ type: "asset", fileName });

describe("buildPrecacheManifest", () => {
  it("lista el código (js y css) con su ruta absoluta, ordenado, y la app como shell", () => {
    const bundle = {
      "assets/b.js": chunk("assets/b.js", ["/src/b.jsx"]),
      "assets/a.js": chunk("assets/a.js", ["/src/a.jsx"]),
      "assets/a.css": asset("assets/a.css"),
      "index.html": asset("index.html"),
      "assets/logo.png": asset("assets/logo.png"),
    };
    const m = buildPrecacheManifest(bundle);
    expect(m.assets).toEqual(["/assets/a.css", "/assets/a.js", "/assets/b.js"]);
    expect(m.shell).toBe("/index.html");
  });

  it("deja fuera el visor 3D (three.js) y lo que lo carga de forma estática, pero no lo que solo lo importa dinámicamente", () => {
    const bundle = {
      "assets/OrbitControls.js": chunk("assets/OrbitControls.js", ["/repo/node_modules/three/src/core/Object3D.js"]),
      "assets/Panorama.js": chunk("assets/Panorama.js", ["/src/components/Panorama360.jsx"], ["assets/OrbitControls.js"]),
      "assets/Visor.js": chunk("assets/Visor.js", ["/src/Visor.jsx"], ["assets/Panorama.js"]),
      "assets/Obra.js": chunk("assets/Obra.js", ["/src/pages/AdminObra.jsx"]), // import() dinámico: no entra en `imports`
      "assets/index.js": chunk("assets/index.js", ["/src/main.jsx"]),
    };
    expect(buildPrecacheManifest(bundle).assets).toEqual(["/assets/Obra.js", "/assets/index.js"]);
  });

  it("también omite @react-three y entiende rutas de Windows", () => {
    const bundle = {
      "assets/fiber.js": chunk("assets/fiber.js", ["C:\\repo\\node_modules\\@react-three\\fiber\\dist\\index.js"]),
      "assets/ok.js": chunk("assets/ok.js", ["C:\\repo\\src\\ok.jsx"]),
    };
    expect(buildPrecacheManifest(bundle).assets).toEqual(["/assets/ok.js"]);
  });

  it("la huella cambia cuando cambia la lista (hashes nuevos) y no depende del orden", () => {
    const a = { "assets/a-1.js": chunk("assets/a-1.js"), "assets/b-1.js": chunk("assets/b-1.js") };
    const reordered = { "assets/b-1.js": chunk("assets/b-1.js"), "assets/a-1.js": chunk("assets/a-1.js") };
    const changed = { "assets/a-2.js": chunk("assets/a-2.js"), "assets/b-1.js": chunk("assets/b-1.js") };
    expect(buildPrecacheManifest(a).build).toBe(buildPrecacheManifest(reordered).build);
    expect(buildPrecacheManifest(a).build).not.toBe(buildPrecacheManifest(changed).build);
    expect(buildPrecacheManifest(a).build).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("precacheManifestPlugin", () => {
  it("emite precache.json con la lista del build", () => {
    const emitted = [];
    const plugin = precacheManifestPlugin();
    plugin.generateBundle.call({ emitFile: (f) => emitted.push(f) }, {}, { "assets/a.js": chunk("assets/a.js") });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe("precache.json");
    expect(JSON.parse(emitted[0].source).assets).toEqual(["/assets/a.js"]);
  });
});
