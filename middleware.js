// Routing Middleware de Vercel (edge, corre antes que el rewrite de la SPA
// en vercel.json). Este sitio es 100% cliente — sin esto, WhatsApp/
// Facebook/etc. jamás ven el título/imagen reales de una propiedad al
// generar la vista previa de un link, porque su robot no ejecuta
// JavaScript y solo ve el index.html genérico (ver Seo.jsx, que arma esos
// datos en el navegador, después de que el robot ya se fue).
//
// La solución NO es convertir el sitio entero a SSR (cambio de
// arquitectura grande, fuera de alcance) — es servirle a ESE robot en
// particular, solo en /propiedades/:id, un HTML mínimo con las etiquetas
// og:*/twitter:* correctas. Cualquier visita real (o cualquier otro
// crawler no listado, incluido Googlebot que sí ejecuta JS) sigue
// exactamente el mismo camino de siempre — `next()` la deja pasar sin
// tocarla.
import { next } from "@vercel/functions";

export const config = {
  matcher: "/propiedades/:id",
};

const SITE_URL = "https://acl-propiedades.vercel.app";

// Solo bots de vista previa de links — no incluye navegadores normales.
const PREVIEW_BOT_PATTERN =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|redditbot|skypeuripreview|vkshare|googlebot|bingbot|applebot|whatsapp/i;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export default async function middleware(request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (!PREVIEW_BOT_PATTERN.test(userAgent)) return next();

  const match = new URL(request.url).pathname.match(/^\/propiedades\/([^/]+)\/?$/);
  if (!match) return next();
  const id = match[1];

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return next();

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/properties?id=eq.${encodeURIComponent(id)}&select=title,description,price,main_image`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!res.ok) return next();
    const [property] = await res.json();
    if (!property) return next();

    const price = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(
      Number(property.price) || 0
    );
    const title = `${property.title} — ${price}`;
    const description = (property.description || "").slice(0, 200);
    const pageUrl = `${SITE_URL}/propiedades/${id}`;
    const imageTag = property.main_image
      ? `<meta property="og:image" content="${escapeHtml(property.main_image)}">\n<meta name="twitter:image" content="${escapeHtml(property.main_image)}">`
      : "";

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="ACL Propiedades">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
${imageTag}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
</body>
</html>
`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return next();
  }
}
