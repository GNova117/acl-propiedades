// Lista de archivos que el service worker (public/sw.js) guarda de antemano para que el panel abra aunque
// no haya señal y la página se recargue. Se genera en cada build como /precache.json:
//   { build: "<huella>", shell: "/index.html", assets: ["/assets/…js", "/assets/…css", …] }
// Los nombres de /assets/ llevan hash, así que `build` (la huella de la lista) cambia cuando cambia el código.
//
// Se guarda todo el código del panel y de lo que comparte con el sitio, salvo lo del visor 3D (three.js: el
// recorrido 360 y la vista previa de cuartos de Construcción), que pesa casi una cuarta parte y no es de uso
// diario; si se abre sin señal, esa pantalla pide conexión como antes.
import { createHash } from "node:crypto";

const HEAVY_MODULE = /[\\/]node_modules[\\/](three|@react-three)[\\/]/;

export const PRECACHE_FILE = "precache.json";
export const SHELL_URL = "/index.html";

const isCode = (fileName) => /\.(js|css)$/.test(fileName);

// `bundle`: el objeto de Rollup/Vite en generateBundle (nombre de archivo -> chunk o asset).
export function buildPrecacheManifest(bundle) {
  const items = Object.values(bundle).filter((item) => isCode(item.fileName));
  const chunks = items.filter((item) => item.type === "chunk");

  // Se omiten los fragmentos del visor 3D y los que lo cargan de forma estática (si no, quedarían a medias).
  const skipped = new Set(chunks.filter((c) => Object.keys(c.modules || {}).some((id) => HEAVY_MODULE.test(id))).map((c) => c.fileName));
  let grew = true;
  while (grew) {
    grew = false;
    for (const chunk of chunks) {
      if (!skipped.has(chunk.fileName) && (chunk.imports || []).some((file) => skipped.has(file))) {
        skipped.add(chunk.fileName);
        grew = true;
      }
    }
  }

  const assets = items.filter((item) => !skipped.has(item.fileName)).map((item) => `/${item.fileName}`);
  assets.sort();
  const build = createHash("sha1").update(assets.join("\n")).digest("hex").slice(0, 12);
  return { build, shell: SHELL_URL, assets };
}

export function precacheManifestPlugin() {
  return {
    name: "acl-precache-manifest",
    apply: "build",
    generateBundle(_options, bundle) {
      this.emitFile({ type: "asset", fileName: PRECACHE_FILE, source: JSON.stringify(buildPrecacheManifest(bundle)) });
    },
  };
}
