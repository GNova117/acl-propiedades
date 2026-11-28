// 501: al borrar una propiedad también se borran sus archivos de Storage (fotos con sus copias en varios tamaños, videos,
// fotos 360° y plano). De la dirección pública de cada archivo se saca su ruta dentro del «bucket».
import { VARIANT_WIDTHS, hasVariants, variantUrl } from "./imageVariants.js";

const BUCKETS = { images: "property-images", videos: "property-videos", tour_360_images: "property-360", floor_plan_url: "property-images" };

// «https://x.supabase.co/storage/v1/object/public/property-images/ruta/foto.jpg?v=1» → «ruta/foto.jpg» (o null si no es de ese bucket)
export function storagePathFromUrl(url, bucket) {
  const text = String(url ?? "");
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = text.indexOf(marker);
  if (at === -1) return null;
  const raw = text.slice(at + marker.length).split(/[?#]/)[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// → { "property-images": ["a.jpg", "a.w480.webp", …], "property-videos": [...], "property-360": [...] } sin repetidos ni vacíos
export function propertyMediaPaths(property) {
  const out = {};
  const add = (bucket, url) => {
    const path = storagePathFromUrl(url, bucket);
    if (!path) return;
    const paths = (out[bucket] ||= []);
    if (!paths.includes(path)) paths.push(path);
  };
  for (const url of property?.images || []) {
    add(BUCKETS.images, url);
    if (hasVariants(url)) for (const width of VARIANT_WIDTHS) add(BUCKETS.images, variantUrl(url, width));
  }
  for (const url of property?.videos || []) add(BUCKETS.videos, url);
  for (const url of property?.tour_360_images || []) add(BUCKETS.tour_360_images, url);
  if (property?.floor_plan_url) add(BUCKETS.floor_plan_url, property.floor_plan_url);
  return out;
}
