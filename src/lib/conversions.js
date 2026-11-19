// Conversiones del sitio público para Google Analytics 4: qué se mide, con qué nombre y con qué datos. Todo pasa por aquí para
// que el catálogo de eventos sea uno solo (README → «Conversiones en Analytics») y para garantizar que NUNCA salga un dato
// personal: solo se mandan las claves permitidas de abajo (nada de nombre, correo ni teléfono, aunque alguien las pase por error).
import { trackEvent } from "./analytics.js";

// tipo de conversión → nombre del evento en GA4. Los de visitas conservan el nombre que ya tenían (cambiarlo rompería el histórico).
export const CONVERSIONS = {
  lead_form: "generate_lead", // se envió un formulario (contacto, vende tu casa, información de una propiedad)
  alert_signup: "alert_signup", // pidió avisos de propiedades nuevas o de baja de precio
  whatsapp_click: "contact_whatsapp", // tocó un enlace para escribir por WhatsApp a la oficina
  phone_click: "contact_phone", // tocó el teléfono de la oficina
  visit_slot_selected: "visit_slot_selected",
  visit_requested: "visit_requested",
  visit_booked: "visit_booked",
  favorite_add: "add_to_wishlist",
  share: "share",
  pdf_download: "download_ficha",
};

// Lo único que puede viajar con un evento.
const ALLOWED_PARAMS = ["form", "location", "method", "property_id", "property_type", "mode", "content_type"];

// → { name, params } o null si el tipo no existe. Descarta cualquier clave no permitida y recorta los textos.
export function buildConversion(kind, params = {}) {
  const name = CONVERSIONS[kind];
  if (!name) return null;
  const clean = {};
  for (const key of ALLOWED_PARAMS) {
    const value = params?.[key];
    if (value !== undefined && value !== null && value !== "") clean[key] = typeof value === "string" ? value.slice(0, 80) : value;
  }
  return { name, params: clean };
}

export function trackConversion(kind, params) {
  const conversion = buildConversion(kind, params);
  if (conversion) trackEvent(conversion.name, conversion.params);
}

// «/propiedades/casa-…-ACL-1001» → «property_detail»: dónde ocurrió, sin mandar la dirección completa.
export function pageGroup(pathname) {
  const path = String(pathname || "/");
  if (path === "/") return "home";
  if (/^\/propiedades\/zona\//.test(path)) return "zone_landing";
  if (/^\/propiedades\/[^/]+$/.test(path)) return "property_detail";
  if (path === "/propiedades" || /^\/(naves-industriales|terrenos)/.test(path)) return "listing";
  if (/^\/desarrollos/.test(path)) return "development";
  return path.split("/")[1] || "home";
}

// ¿Es un enlace de CONTACTO por WhatsApp (wa.me/<número>…) y no uno de «compartir» (wa.me/?text=…)?
export const isWhatsappContactHref = (href) => /^https?:\/\/(wa\.me|api\.whatsapp\.com\/send)\/?(\d{8,15})(\?|$|\/)/i.test(String(href || "")) || /^https?:\/\/api\.whatsapp\.com\/send\?[^#]*phone=\d{8,15}/i.test(String(href || ""));
export const isPhoneHref = (href) => /^tel:/i.test(String(href || ""));

// Escucha los clics de TODO el documento (así cubre cada botón de WhatsApp o teléfono del sitio, también los que se agreguen
// después, sin tocarlos uno por uno). Devuelve la función para dejar de escuchar.
export function installConversionClicks(doc = document, getPathname = () => window.location.pathname) {
  const onClick = (event) => {
    const link = event.target?.closest?.("a[href]");
    if (!link) return;
    const href = link.getAttribute("href");
    const location = pageGroup(getPathname());
    if (isWhatsappContactHref(href)) trackConversion("whatsapp_click", { location });
    else if (isPhoneHref(href)) trackConversion("phone_click", { location });
  };
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
}
