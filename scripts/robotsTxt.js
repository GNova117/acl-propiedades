// robots.txt con la dirección pública del sitio. public/robots.txt es la plantilla (con la dirección de Vercel); al
// construir, si hay SITE_URL o VITE_SITE_URL (https) se cambia la línea «Sitemap:» por la del dominio propio.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveSiteUrl } from "../server/siteUrl.js";

export function withSiteUrl(robotsTxt, siteUrl) {
  const line = `Sitemap: ${siteUrl}/sitemap.xml`;
  return /^Sitemap:.*$/m.test(robotsTxt) ? robotsTxt.replace(/^Sitemap:.*$/m, line) : `${robotsTxt.replace(/\s*$/, "\n")}\n${line}\n`;
}

export function robotsPlugin() {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "acl-robots-txt",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
      root = config.root;
    },
    closeBundle() {
      const source = readFileSync(resolve(root, "public/robots.txt"), "utf8");
      writeFileSync(resolve(root, outDir, "robots.txt"), withSiteUrl(source, resolveSiteUrl(process.env)));
    },
  };
}
