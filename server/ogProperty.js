// /api/og?id=<uuid>: la imagen para compartir una propiedad (foto + precio + datos, ver ogImage.js). Solo se arma con lo
// que está en la base para ESE id (la foto de la propiedad); nunca con una URL que mande quien pide la imagen. Si algo
// falla (no hay base, no existe la propiedad, la foto no baja o pesa de más) se responde con la imagen de la marca, para
// que el enlace compartido nunca se vea roto. Dependencias inyectadas para probarlo sin red.
import { propertyImagePng } from "./ogImage.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TIMEOUT_MS = 6000;
const FALLBACK = { status: 302, headers: { Location: "/og-default.png", "Cache-Control": "public, max-age=300" }, body: "" };

// La foto solo se baja de donde el sitio guarda las suyas (Supabase Storage) o de la foto de ejemplo del modo demo.
export function isAllowedPhotoUrl(url, supabaseUrl) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  let supabaseHost = null;
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;
  } catch {
    supabaseHost = null;
  }
  return parsed.hostname === "images.unsplash.com" || (supabaseHost !== null && parsed.hostname === supabaseHost);
}

export async function propertyOgResponse({ id, env = {}, fetchImpl = fetch, canvasApi, loadImage }) {
  if (!UUID.test(String(id || ""))) return { status: 400, headers: { "Cache-Control": "no-store" }, body: "bad id" };
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) return FALLBACK;
  try {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/properties?id=eq.${encodeURIComponent(id)}&active=eq.true&select=title,price,type,operation_type,bedrooms,bathrooms,parking,area_m2,zone,main_image`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return FALLBACK;
    const [property] = await res.json();
    if (!property) return FALLBACK;

    let photo = null;
    if (property.main_image && isAllowedPhotoUrl(property.main_image, supabaseUrl)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PHOTO_TIMEOUT_MS);
        const photoRes = await fetchImpl(property.main_image, { signal: controller.signal }).finally(() => clearTimeout(timer));
        const length = Number(photoRes.headers.get("content-length") || 0);
        if (photoRes.ok && /^image\//.test(photoRes.headers.get("content-type") || "") && length <= MAX_PHOTO_BYTES) {
          const bytes = Buffer.from(await photoRes.arrayBuffer());
          if (bytes.length <= MAX_PHOTO_BYTES) photo = await loadImage(bytes);
        }
      } catch {
        photo = null; // sin foto: se dibuja con el fondo de la marca
      }
    }
    const png = propertyImagePng(canvasApi, { photo, property });
    return { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }, body: png };
  } catch {
    return FALLBACK;
  }
}
