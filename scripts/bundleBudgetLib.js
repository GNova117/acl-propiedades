// Presupuesto de peso del paquete (parte pura; scripts/bundleBudget.mjs lee dist/ y compara). Mide lo que el navegador baja
// SIEMPRE al abrir el sitio: el script de entrada, los módulos precargados y las hojas de estilo que enlaza dist/index.html.
// Lo que se carga bajo demanda (el visor 3D, el mapa, el panel) no cuenta aquí: va en su propio tope por archivo.

// → { scripts: ["assets/a.js", ...], styles: ["assets/a.css", ...] } (rutas relativas a dist/, sin repetir)
export function initialAssets(html) {
  const scripts = new Set();
  const styles = new Set();
  for (const match of String(html).matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const url = /(?:src|href)="([^"]+)"/i.exec(tag)?.[1];
    if (!url || /^https?:/i.test(url)) continue;
    const path = url.replace(/^\//, "");
    if (/<script\b[^>]*type="module"/i.test(tag) || /rel="modulepreload"/i.test(tag)) scripts.add(path);
    else if (/rel="stylesheet"/i.test(tag)) styles.add(path);
  }
  return { scripts: [...scripts], styles: [...styles] };
}

// sizes: [{ file, gzipBytes }]; budget: { initialJsGzipKB, initialCssGzipKB, maxChunkGzipKB } → lista de incumplimientos (vacía = bien)
export function checkBudget({ initial, sizes, budget }) {
  const bytes = (files) => files.reduce((sum, f) => sum + (sizes.find((s) => s.file === f)?.gzipBytes || 0), 0);
  const kb = (n) => Math.round((n / 1024) * 10) / 10;
  const problems = [];
  const js = kb(bytes(initial.scripts));
  const css = kb(bytes(initial.styles));
  if (js > budget.initialJsGzipKB) problems.push(`JavaScript inicial: ${js} KB (gzip) pasa el tope de ${budget.initialJsGzipKB} KB`);
  if (css > budget.initialCssGzipKB) problems.push(`CSS inicial: ${css} KB (gzip) pasa el tope de ${budget.initialCssGzipKB} KB`);
  const initialSet = new Set([...initial.scripts, ...initial.styles]);
  for (const { file, gzipBytes } of sizes) {
    if (!initialSet.has(file) && file.endsWith(".js") && kb(gzipBytes) > budget.maxChunkGzipKB) {
      problems.push(`${file}: ${kb(gzipBytes)} KB (gzip) pasa el tope de ${budget.maxChunkGzipKB} KB por archivo cargado bajo demanda`);
    }
  }
  return { problems, initialJsKB: js, initialCssKB: css };
}
