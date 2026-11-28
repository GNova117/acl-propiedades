// Piezas puras del sitemap (api/sitemap.js las usa): qué propiedades se listan y cómo se escribe el XML, con imágenes.

// Una propiedad vendida o rentada se deja en el sitemap unas semanas (para que Google vea el cambio) y luego sale: seguir mandando
// gente a fichas ya vendidas no sirve.
export const CLOSED_LISTING_DAYS = 45;

export function propertyInSitemap(row, now = new Date()) {
  if (row.status !== "vendida" && row.status !== "rentada") return true;
  const changed = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  return Number.isFinite(changed) && now.getTime() - changed < CLOSED_LISTING_DAYS * 86400000;
}

export const escapeXml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

// Hasta 10 fotos por página, solo direcciones https (Google Imágenes).
export function sitemapImages(row) {
  const list = [row.main_image, ...(Array.isArray(row.images) ? row.images : [])].filter((u) => typeof u === "string" && /^https:\/\//.test(u));
  return [...new Set(list)].slice(0, 10);
}

// urls: [{ loc, lastmod?, images?: [url] }]
export function buildSitemapXml(urls) {
  const entry = (u) =>
    `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}` +
    (u.images || []).map((src) => `<image:image><image:loc>${escapeXml(src)}</image:loc></image:image>`).join("") +
    "</url>";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls.map(entry).join("\n") +
    `\n</urlset>\n`
  );
}
