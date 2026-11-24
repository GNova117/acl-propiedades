// Fotos en varios tamaños. Al subir una foto de propiedad se guardan, además de la foto grande (1920 px, JPEG), dos copias
// WebP más livianas (480 y 960 px de ancho) con el mismo nombre. El navegador elige la más chica que le alcance
// (srcset/sizes): una miniatura o una tarjeta ya no descarga la foto completa.
// No hace falta una columna nueva en la base: las fotos subidas CON copias llevan «_rs» antes de la extensión
// (casa_rs.jpg → casa_rs.w480.webp, casa_rs.w960.webp). Las fotos anteriores (sin la marca) se siguen sirviendo tal cual.
export const VARIANT_WIDTHS = [480, 960];
export const VARIANT_MARK = "_rs";

const EXTENSION = /\.([a-z0-9]+)(\?[^#]*)?(#.*)?$/i;
const MARKED = /_rs\.[a-z0-9]+(\?[^#]*)?(#.*)?$/i;

// ¿Esta foto tiene sus copias en varios tamaños? (solo fotos alojadas en una dirección http/https y subidas con la marca)
export const hasVariants = (url) => typeof url === "string" && /^https?:\/\//i.test(url) && MARKED.test(url);

// «…/casa_rs.jpg?x=1» → «…/casa_rs.w480.webp?x=1»
export function variantUrl(url, width) {
  return String(url).replace(EXTENSION, (_, _ext, query = "", hash = "") => `.w${width}.webp${query}${hash}`);
}

// «casa.jpg» → «casa_rs.jpg» (nombre con el que se sube la foto grande cuando sí lleva copias)
export function markVariantName(fileName) {
  const name = String(fileName || "foto.jpg");
  return EXTENSION.test(name) ? name.replace(EXTENSION, (_, ext) => `${VARIANT_MARK}.${ext}`) : `${name}${VARIANT_MARK}`;
}

// Atributos de <img> para una foto: con copias, `srcSet`+`sizes` (y una copia mediana como `src`); sin copias, solo `src`.
// `sizes`: el ancho que ocupa en pantalla, p. ej. "(max-width: 640px) 100vw, 400px".
export function responsiveProps(url, sizes) {
  if (!hasVariants(url)) return { src: url };
  const [small, medium] = VARIANT_WIDTHS;
  return {
    src: variantUrl(url, medium),
    srcSet: `${variantUrl(url, small)} ${small}w, ${variantUrl(url, medium)} ${medium}w, ${url} 1920w`,
    sizes: sizes || "100vw",
  };
}
