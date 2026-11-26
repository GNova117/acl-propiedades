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
import { resolveSiteUrl } from "./server/siteUrl.js";
import { parsePropertyRef, propertyPath } from "./src/lib/propertyUrl.js";
import { findCityBySlug } from "./src/lib/zoneLandingPages.js";

export const config = {
  matcher: [
    "/",
    "/propiedades",
    "/propiedades/:id",
    "/propiedades/zona/:path*",
    "/terrenos",
    "/naves-industriales",
    "/nosotros",
    "/contacto",
    "/guia-del-comprador",
    "/seleccion/:token",
    "/favoritos",
    "/calculadora",
    "/vende-tu-casa",
    "/comparar-creditos",
    "/simulador-credito",
    "/blog",
    "/blog/:slug",
    "/desarrollos/:slug",
    "/aviso-de-privacidad",
    "/carta-de-derechos",
    "/terminos-y-condiciones",
  ],
};

// Dirección pública (variable SITE_URL / VITE_SITE_URL; ver server/siteUrl.js).
const SITE_URL = resolveSiteUrl(process.env);

// Solo bots de vista previa de links — no incluye navegadores normales. NO incluye a Google, Bing ni Apple (googlebot,
// bingbot, applebot): esos EJECUTAN JavaScript y deben ver el sitio de verdad (fotos, enlaces, datos estructurados), no
// el HTML mínimo de título y descripción que se les servía antes y que los dejaba con una página casi vacía.
const PREVIEW_BOT_PATTERN =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|redditbot|skypeuripreview|vkshare/i;

// Imagen de la marca (logo y texto sobre azul, hecha con scripts/build-og-image.mjs): para el inicio y las páginas sin
// foto propia. Las propiedades usan /api/og?id=… (su foto con el precio y los datos encima; si algo falla, esa función
// responde con esta misma imagen). Ver también Seo.jsx, que tiene su propia copia de esta ruta para el lado del
// navegador (no se puede compartir el módulo: ahí corre en el bundle de Vite, aquí en el edge).
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

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
    title: "Naves industriales | ACL Propiedades",
    description: "Naves industriales, bodegas y espacios comerciales en renta y venta en La Comarca Lagunera. Consulta las disponibles y pide asesoría.",
  },
  "/calculadora": {
    title: "Calculadora de valor de tu propiedad | ACL Propiedades",
    description: "Estima cuánto vale tu casa o terreno en La Comarca Lagunera según la zona, el tipo y la superficie.",
  },
  "/vende-tu-casa": {
    title: "Vende tu casa | ACL Propiedades",
    description: "Te ayudamos a vender tu casa, terreno o nave en La Comarca Lagunera: valuación, promoción y acompañamiento hasta la firma.",
  },
  "/comparar-creditos": {
    title: "Comparar créditos hipotecarios | ACL Propiedades",
    description: "Compara INFONAVIT, bancario y FOVISSSTE y descubre cuál te conviene para comprar tu casa.",
  },
  "/simulador-credito": {
    title: "Simulador de crédito hipotecario | ACL Propiedades",
    description: "Calcula tu mensualidad y cuánto crédito puedes pedir para comprar una propiedad.",
  },
  "/blog": {
    title: "Blog | ACL Propiedades",
    description: "Artículos y guías sobre compra, venta, crédito y naves industriales en Torreón, Gómez Palacio y Lerdo.",
  },
  "/aviso-de-privacidad": {
    title: "Aviso de privacidad | ACL Propiedades",
    description: "Cómo cuidamos y usamos tus datos personales y cómo ejercer tus derechos ARCO.",
  },
  "/carta-de-derechos": {
    title: "Carta de derechos del cliente | ACL Propiedades",
    description: "Tus derechos como comprador, vendedor o arrendatario al trabajar con ACL Propiedades.",
  },
  "/terminos-y-condiciones": {
    title: "Términos y condiciones | ACL Propiedades",
    description: "Condiciones de uso del sitio de ACL Propiedades.",
  },
  "/nosotros": {
    title: "Nosotros | ACL Propiedades",
    description:
      "Somos una inmobiliaria especializada en la compra y venta de casas, departamentos, terrenos y naves industriales en La Comarca Lagunera.",
  },
  "/guia-del-comprador": {
    title: "Guía del comprador (PDF gratis) | ACL Propiedades",
    description: "Presupuesto, créditos, documentos y el paso a paso para comprar tu casa. Descárgala gratis.",
  },
  "/contacto": {
    title: "Contacto | ACL Propiedades",
    description: "¿Tienes dudas o buscas una propiedad específica? Escríbenos y un asesor te contactará.",
  },
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Selección de propiedades que un asesor manda por WhatsApp (/seleccion/<token>): la vista previa es genérica a propósito
// (no revela cuántas propiedades ni para quién) y no se indexa: el enlace es privado.
// Lista de favoritos compartida (/favoritos?lista=…): vista previa genérica y sin indexar (es una lista personal).
const FAVORITES_PAGE = {
  title: "Lista de propiedades | ACL Propiedades",
  description: "Te compartieron una lista de propiedades. Entra para ver fotos y precios, y guárdala en tus favoritos.",
};

const SELECTION_PAGE = {
  title: "Selección de propiedades | ACL Propiedades",
  description: "Tu asesor preparó una selección de propiedades para ti. Entra para ver fotos, precios y coordinar tu visita.",
};

function renderPreviewHtml({ title, description, url, image, noindex = false }) {
  const imageTag = image
    ? `<meta property="og:image" content="${escapeHtml(image)}">\n<meta name="twitter:image" content="${escapeHtml(image)}">`
    : "";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${noindex ? '<meta name="robots" content="noindex, nofollow, noarchive">\n' : ""}<meta property="og:type" content="website">
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

async function propertyPreviewResponse(param) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  const ref = parsePropertyRef(param);
  if (!ref) return null;

  // La dirección puede traer el identificador (las de siempre) o el título y el código (las legibles).
  const filter = ref.kind === "code" ? `code=eq.${encodeURIComponent(ref.code)}` : `id=eq.${encodeURIComponent(ref.id)}`;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/properties?${filter}&select=id,code,title,description,price,main_image`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  if (!res.ok) return null;
  const [property] = await res.json();
  if (!property) return null;
  const id = property.id;

  const price = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(
    Number(property.price) || 0
  );
  const html = renderPreviewHtml({
    title: `${property.title} — ${price}`,
    description: (property.description || "").replace(/\s+/g, " ").trim().slice(0, 200),
    url: `${SITE_URL}${propertyPath(property)}`,
    image: `${SITE_URL}/api/og?id=${encodeURIComponent(id)}`,
  });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

// Consulta de una fila pública en Supabase (anon). null si no hay base configurada, no existe o falla.
async function fetchRow(path) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
  if (!res.ok) return null;
  const [row] = await res.json();
  return row || null;
}

const cleanText = (value, max = 200) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const titleCase = (slug) => slug.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

// /blog/<slug>: título, resumen y portada del artículo publicado.
async function blogPreview(slug, url) {
  const post = await fetchRow(`blog_posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=title,excerpt,cover_image`);
  if (!post) return null;
  return renderPreviewHtml({ title: `${post.title} | ACL Propiedades`, description: cleanText(post.excerpt) || GENERIC_PAGES["/blog"].description, url, image: post.cover_image || DEFAULT_IMAGE });
}

// /desarrollos/<slug>: nombre, lema y foto del desarrollo publicado.
async function developmentPreview(slug, url) {
  const development = await fetchRow(`developments?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=name,tagline,description,hero_image`);
  if (!development) return null;
  return renderPreviewHtml({
    title: `${development.name} | ACL Propiedades`,
    description: cleanText(development.tagline || development.description) || "Departamentos en desarrollo en La Comarca Lagunera.",
    url,
    image: development.hero_image || DEFAULT_IMAGE,
  });
}

// /propiedades/zona/<ciudad>[/<colonia>]: páginas de aterrizaje por ciudad y colonia.
function zonePreview(pathname, url) {
  const [, , , citySlug, colonySlug] = pathname.replace(/\/$/, "").split("/");
  const city = findCityBySlug(citySlug);
  if (!city) return null;
  const place = colonySlug ? `${titleCase(colonySlug)}, ${city}` : city;
  return renderPreviewHtml({
    title: `Propiedades en ${place} | ACL Propiedades`,
    description: `Casas, departamentos y terrenos en ${place}. Mira fotos, precios y agenda tu visita.`,
    url,
    image: DEFAULT_IMAGE,
  });
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

    const blogMatch = pathname.match(/^\/blog\/([^/]+)\/?$/);
    const developmentMatch = pathname.match(/^\/desarrollos\/([^/]+)\/?$/);
    const previewUrl = `${SITE_URL}${pathname}`;
    let dynamic = null;
    if (blogMatch) dynamic = await blogPreview(blogMatch[1], previewUrl);
    else if (developmentMatch) dynamic = await developmentPreview(developmentMatch[1], previewUrl);
    else if (/^\/propiedades\/zona\//.test(pathname)) dynamic = zonePreview(pathname, previewUrl);
    if (dynamic) return new Response(dynamic, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (blogMatch || developmentMatch || pathname.startsWith("/propiedades/zona/")) return next();

    if (/^\/seleccion\/[0-9a-f]{32}\/?$/.test(pathname)) {
      const html = renderPreviewHtml({ ...SELECTION_PAGE, url: `${SITE_URL}${pathname}`, image: DEFAULT_IMAGE, noindex: true });
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (pathname.replace(/\/$/, "") === "/favoritos") {
      const html = renderPreviewHtml({ ...FAVORITES_PAGE, url: `${SITE_URL}/favoritos`, image: DEFAULT_IMAGE, noindex: true });
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    const generic = GENERIC_PAGES[pathname === "/" ? "/" : pathname.replace(/\/$/, "")];
    if (!generic) return next();

    const html = renderPreviewHtml({ ...generic, url: `${SITE_URL}${pathname}`, image: DEFAULT_IMAGE });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return next();
  }
}
