import { responsiveProps } from "../lib/imageVariants";

// <img> de una foto de propiedad: si tiene copias en varios tamaños, el navegador elige la que le alcance (`sizes` = el ancho
// que ocupa en pantalla); si no, se comporta como un <img> normal.
export default function ResponsiveImg({ src, sizes, alt = "", ...rest }) {
  return <img {...responsiveProps(src, sizes)} alt={alt} {...rest} />;
}
