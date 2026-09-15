// Routing Middleware de Vercel (edge, corre antes que el rewrite de la SPA
// en vercel.json). Este sitio es 100% cliente — sin esto, WhatsApp/
// Facebook/etc. jamás ven el título/imagen reales de una página al
// generar la vista previa de un link, porque su robot no ejecuta
// JavaScript y solo ve el index.html genérico (ver Seo.jsx, que arma esos
// datos en el navegador, después de que el robot ya se fue).
//
// La solución NO es convertir el sitio entero a SSR (cambio de
// arquitectura grande, fuera de alcance) — es servirle a ESE robot en
// particular, en las rutas listadas en `config.matcher`, un HTML mínimo
// con las etiquetas og:*/twitter:* correctas: por propiedad
// (/propiedades/:id, foto real de la propiedad) o genéricas (home y demás
// páginas fijas, GENERIC_PAGES abajo, con DEFAULT_IMAGE). Cualquier visita
// real (o cualquier otro crawler no listado, incluido Googlebot que sí
// ejecuta JS) sigue exactamente el mismo camino de siempre — `next()` la
// deja pasar sin tocarla.
import { next } from "@vercel/functions";

export const config = {
  matcher: ["/", "/propiedades", "/propiedades/:id", "/terrenos", "/naves-industriales", "/nosotros", "/contacto"],
};

const SITE_URL = "https://acl-propiedades.vercel.app";

// Solo bots de vista previa de links — no incluye navegadores normales.
const PREVIEW_BOT_PATTERN =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|redditbot|skypeuripreview|vkshare|googlebot|bingbot|applebot|whatsapp/i;

// Foto de stock temporal (misma que usa el panel "Propiedades" del hero de
// inicio, ver src/components/SplitHero.jsx) — reemplazar por un banner
// real de la marca cuando exista uno. Ver también Seo.jsx, que tiene su
// propia copia de este mismo default para el lado del navegador (no se
// puede compartir el módulo: ahí corre en el bundle de Vite, aquí en el
// edge).
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=630&fit=crop&q=80";

// Título/descripción de cada página genérica, iguales a los que ya arma
// Seo.jsx del lado del cliente (ver cada page/*.jsx) — duplicados aquí a
// propósito por la misma razón de arriba, no por un import compartido.
const GENERIC_PAGES = {
  "/": {
    title: "ACL Propiedades",
    description:
      "Casas, departamentos, naves industriales y terrenos en Torreón, Gómez Palacio y Lerdo, con asesoría certificada en INFONAVIT, bancario y FOVISSSTE.",
  },
  "/propiedades": {
    title: "Propiedades disponibles | ACL Propiedades",
    description: "Filtra por tipo, zona, precio y superficie para encontrar tu propiedad ideal.",
  },
  "/terrenos": {
    title: "Terrenos disponibles | ACL Propiedades",
    description: "Filtra por zona, precio y superficie para encontrar el terreno ideal para tu proyecto.",
  },
  "/naves-industriales": {
    title: "Naves industriales disponibles | ACL Propiedades",
    description: "Este apartado estará disponible próximamente.",
  },
  "/nosotros": {
    title: "Nosotros | ACL Propiedades",
    description:
      "Somos una inmobiliaria especializada en la compra y venta de casas, departamentos, terrenos y naves industriales en La Comarca Lagunera.",
  },
  "/contacto": {
    title: "Contacto | ACL Propiedades",
    description: "¿Tienes dudas o buscas una propiedad específica? Escríbenos y un asesor te contactará.",
  },
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function renderPreviewHtml({ title, description, url, image }) {
  const imageTag = image
    ? `<meta property="og:image" content="${escapeHtml(image)}">\n<meta name="twitter:image" content="${escapeHtml(image)}">`
    : "";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="ACL Propiedades">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
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
}

async function propertyPreviewResponse(id) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/properties?id=eq.${encodeURIComponent(id)}&select=title,description,price,main_image`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  if (!res.ok) return null;
  const [property] = await res.json();
  if (!property) return null;

  const price = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(
    Number(property.price) || 0
  );
  const html = renderPreviewHtml({
    title: `${property.title} — ${price}`,
    description: (property.description || "").replace(/\s+/g, " ").trim().slice(0, 200),
    url: `${SITE_URL}/propiedades/${id}`,
    image: property.main_image,
  });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export default async function middleware(request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (!PREVIEW_BOT_PATTERN.test(userAgent)) return next();

  const pathname = new URL(request.url).pathname;
  const match = pathname.match(/^\/propiedades\/([^/]+)\/?$/);

  try {
    if (match) {
      const response = await propertyPreviewResponse(match[1]);
      return response || next();
    }

    const generic = GENERIC_PAGES[pathname === "/" ? "/" : pathname.replace(/\/$/, "")];
    if (!generic) return next();

    const html = renderPreviewHtml({ ...generic, url: `${SITE_URL}${pathname}`, image: DEFAULT_IMAGE });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return next();
  }
}
