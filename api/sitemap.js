// Función serverless de Vercel (primera en este proyecto — el resto del
// sitio es una SPA estática sobre Supabase). Sirve /sitemap.xml en vivo,
// consultado en cada visita en vez de generado en build, según lo pedido:
// las propiedades cambian por Supabase de forma independiente a los
// deploys, así que un sitemap estático quedaría desactualizado entre uno
// y otro. Usa la llave pública (anon) — RLS ya permite lectura pública de
// properties, no hace falta la service role aquí.
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://acl-propiedades.vercel.app";
const STATIC_PATHS = ["/", "/propiedades", "/naves-industriales", "/terrenos", "/calculadora", "/nosotros", "/contacto"];

export default async function handler(req, res) {
  const urls = STATIC_PATHS.map((path) => ({ loc: `${SITE_URL}${path}` }));

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const { data } = await supabase.from("properties").select("id, updated_at").eq("active", true);
      for (const row of data || []) {
        urls.push({ loc: `${SITE_URL}/propiedades/${row.id}`, lastmod: row.updated_at ? row.updated_at.slice(0, 10) : undefined });
      }
    } catch {
      // Si Supabase falla, el sitemap igual sirve las páginas estáticas
      // en vez de devolver un error — mejor un sitemap parcial que ninguno.
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(xml);
}
