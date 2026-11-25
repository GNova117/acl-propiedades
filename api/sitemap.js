// Función serverless de Vercel (primera en este proyecto — el resto del
// sitio es una SPA estática sobre Supabase). Sirve /sitemap.xml en vivo,
// consultado en cada visita en vez de generado en build, según lo pedido:
// las propiedades cambian por Supabase de forma independiente a los
// deploys, así que un sitemap estático quedaría desactualizado entre uno
// y otro. Usa la llave pública (anon) — RLS ya permite lectura pública de
// properties, no hace falta la service role aquí.
import { createClient } from "@supabase/supabase-js";
import { colonyPath, slugify, ZONE_LANDING_CITIES } from "../src/lib/zoneLandingPages.js";
import { propertyPath } from "../src/lib/propertyUrl.js";
import { resolveSiteUrl } from "../server/siteUrl.js";

// Dirección pública (variable SITE_URL / VITE_SITE_URL; ver server/siteUrl.js).
const SITE_URL = resolveSiteUrl(process.env);
const STATIC_PATHS = ["/", "/propiedades", "/naves-industriales", "/terrenos", "/calculadora", "/simulador-credito", "/comparar-creditos", "/guia-del-comprador", "/nosotros", "/contacto", "/blog", "/terminos-y-condiciones"];
const ZONE_PATHS = ZONE_LANDING_CITIES.map((city) => `/propiedades/zona/${slugify(city)}`);

export default async function handler(req, res) {
  const urls = [...STATIC_PATHS, ...ZONE_PATHS].map((path) => ({ loc: `${SITE_URL}${path}` }));

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const { data } = await supabase.from("properties").select("id, code, title, updated_at, zone, status").eq("active", true);
      for (const row of data || []) {
        urls.push({ loc: `${SITE_URL}${propertyPath(row)}`, lastmod: row.updated_at ? row.updated_at.slice(0, 10) : undefined });
      }
      // Una página por colonia con al menos una propiedad disponible (las vacías no se listan: serían páginas casi sin contenido).
      const colonyPaths = new Set();
      for (const row of data || []) {
        const path = row.status === "disponible" ? colonyPath(row.zone) : null;
        if (path) colonyPaths.add(path);
      }
      for (const path of [...colonyPaths].sort()) urls.push({ loc: `${SITE_URL}${path}` });
      // Torres publicadas (si la tabla aún no existe, `data` llega nulo y no se agrega nada).
      const { data: developments } = await supabase.from("developments").select("slug, updated_at").eq("published", true);
      for (const row of developments || []) {
        urls.push({ loc: `${SITE_URL}/desarrollos/${row.slug}`, lastmod: row.updated_at ? row.updated_at.slice(0, 10) : undefined });
      }
      const { data: posts } = await supabase.from("blog_posts").select("slug, updated_at").eq("published", true);
      for (const row of posts || []) {
        urls.push({ loc: `${SITE_URL}/blog/${row.slug}`, lastmod: row.updated_at ? row.updated_at.slice(0, 10) : undefined });
      }
    } catch {
      // Si Supabase falla, el sitemap igual sirve las páginas estáticas
      // en vez de devolver un error — mejor un sitemap parcial que ninguno.
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(xml);
}
