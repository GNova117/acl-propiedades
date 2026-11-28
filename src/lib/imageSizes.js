// 222: las fotos de stock (Unsplash) aceptan el ancho en la dirección (`w=900`). Con varias anchuras en `srcset` el teléfono baja
// la imagen chica y la laptop la grande, en vez de las dos la misma. Cualquier otra dirección (una foto propia subida desde el
// panel) no se toca: devuelve null y se usa como siempre.
const UNSPLASH = "images.unsplash.com";

export function unsplashSrcSet(url, widths = [480, 900]) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== UNSPLASH || !parsed.searchParams.has("w")) return null;
    return widths
      .map((w) => {
        const copy = new URL(parsed.href);
        copy.searchParams.set("w", String(w));
        return `${copy.href} ${w}w`;
      })
      .join(", ");
  } catch {
    return null;
  }
}
