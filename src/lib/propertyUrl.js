// Direcciones LEGIBLES de las propiedades: /propiedades/casa-en-residencial-senderos-ACL-1001 en lugar de
// /propiedades/<identificador largo>. La dirección lleva el título y, al final, el CÓDIGO de la propiedad (ACL-1001),
// que es único y fijo: aunque el título cambie, el código identifica la propiedad. Las direcciones viejas (con el
// identificador) siguen funcionando y la ficha redirige a la nueva (ver PropertyDetail). Funciones puras, sin acceso a
// datos: las usan el navegador, el sitemap y el middleware de vista previa.
import { slugify } from "./zoneLandingPages.js";

const MAX_TITLE_SLUG = 70;
// Código al final de la dirección: letras, guion y números (ACL-1001), precedido de un guion y algo de título.
const CODE_AT_END = /^(.+)-([A-Za-z]{2,6}-\d{1,8})$/;
// Una dirección que ES un código (ACL-1001) sin título delante: se busca por código también.
const BARE_CODE = /^[A-Za-z]{2,6}-\d{1,8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// «casa-en-residencial-senderos-ACL-1001». Sin código (propiedades sin código) cae al identificador.
export function propertySlug(property) {
  const code = String(property?.code || "").trim().toUpperCase();
  if (!/^[A-Z]{2,6}-\d{1,8}$/.test(code)) return String(property?.id ?? "");
  const title = slugify(property?.title || "").slice(0, MAX_TITLE_SLUG).replace(/-+$/g, "");
  return title ? `${title}-${code}` : code;
}

export const propertyPath = (property) => `/propiedades/${propertySlug(property)}`;

// Qué propiedad pide una dirección: { kind: "id", id } o { kind: "code", code }; null si no hay nada que buscar.
export function parsePropertyRef(param) {
  const value = String(param ?? "").trim();
  if (!value) return null;
  if (UUID.test(value)) return { kind: "id", id: value };
  const withTitle = CODE_AT_END.exec(value);
  if (withTitle) return { kind: "code", code: withTitle[2].toUpperCase() };
  if (BARE_CODE.test(value) && /^[A-Za-z]{3,6}-\d{3,8}$/.test(value) && /^acl/i.test(value)) return { kind: "code", code: value.toUpperCase() };
  return { kind: "id", id: value };
}

// ¿La dirección que se usó es la canónica de esa propiedad?
export const isCanonicalSlug = (param, property) => String(param) === propertySlug(property);
