// Un solo lugar para armar «slugs»: texto sin acentos, en minúsculas y con un separador.
// - `keySlug`: separa con guion bajo (llaves guardadas: tipos de propiedad, catálogos, roles).
// - `urlSlug`: separa con guion (direcciones de página: zonas, desarrollos, artículos).
// Los dos usan la misma regla; solo cambia el separador (antes había tres copias con pequeñas diferencias).
export function slugWith(separator, text) {
  const edge = new RegExp(`^${separator}+|${separator}+$`, "g");
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, separator)
    .replace(edge, "");
}

export const keySlug = (text) => slugWith("_", text);
export const urlSlug = (text) => slugWith("-", text);
