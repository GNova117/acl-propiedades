// Textos de anuncio redactados por Claude (api/ad-copy.js, server/adCopy.js).
// Aquí vive lo que no depende de la red y se puede probar: los datos reales de
// la propiedad que se le entregan a Claude y la revisión de lo que devuelve.
// Un texto "orgánico" es bienvenido, pero un anuncio que inventa el precio, las
// recámaras, un teléfono o un enlace es un problema real: lo que contradiga la
// ficha se descarta en el servidor antes de llegar al asesor.

// Este archivo también lo importa la función serverless (api/ad-copy.js), que corre
// en Node sin Vite: los imports llevan la extensión .js y solo van a archivos que a
// su vez no importan nada sin ella (por eso la URL se arma aquí y no con socialPost.js).
import { OFFICE_WHATSAPP } from "./office.js";

export const AD_CHANNELS = ["whatsapp", "facebook", "instagram", "portal"];
export const AD_TONES = ["cercano", "profesional", "aspiracional"];
export const MAX_EXTRA_CHARS = 300;

const OFFICE_PHONE_TEXT = `${OFFICE_WHATSAPP.slice(2, 5)} ${OFFICE_WHATSAPP.slice(5, 8)} ${OFFICE_WHATSAPP.slice(8)}`;

const propertyUrl = (property, origin) => `${origin}/propiedades/${property.id}`;

const TYPE_LABELS = { casa: "casa", departamento: "departamento", nave_industrial: "nave industrial", terreno: "terreno" };

const present = (v) => v != null && String(v).trim() !== "";
// Number(null) y Number("") dan 0: un dato que falta no es un cero.
const num = (v) => {
  if (!present(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Quita saltos de línea y comillas invertidas: lo que escribe una persona entra al prompt.
export const promptSafe = (text, max) => String(text ?? "").replace(/[\r\n`]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// La ficha que ve Claude: solo datos que existen en la propiedad. Lo que falta
// no se incluye (así no hay nada que "rellenar").
export function adFacts(property) {
  const facts = {
    tipo: TYPE_LABELS[property.type] || property.type || "propiedad",
    operacion: property.operation_type === "renta" ? "renta" : "venta",
    titulo: promptSafe(property.title, 120),
    precio_mxn: num(property.price),
    zona: promptSafe(property.zone, 80),
    direccion: promptSafe(property.address, 160),
    construccion_m2: num(property.area_m2),
    recamaras: num(property.bedrooms),
    banos: num(property.bathrooms),
    estacionamientos: num(property.parking),
    anio_construccion: num(property.anio_construccion),
    condicion: promptSafe(property.condicion_propiedad, 80),
    acabados: promptSafe(property.acabados, 200),
    servicios: promptSafe(property.servicios, 200),
    amenidades: Array.isArray(property.amenities) ? property.amenities.map((a) => String(a).replace(/_/g, " ")).slice(0, 15) : [],
    descripcion: promptSafe(property.description, 1200),
  };
  return Object.fromEntries(Object.entries(facts).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : present(v))));
}

const toNumber = (text) => Number(String(text).replace(/[,\s]/g, ""));

// Montos en pesos que menciona un texto: "$2,450,000", "$2.45 millones",
// "$850 mil", "2.4 mdp"… (siempre en pesos, sin signo).
export function mentionedPrices(text) {
  const found = [];
  const scale = (unit) => (/^(mil)$/i.test(unit || "") ? 1e3 : /^(millones?|mdp|m)$/i.test(unit || "") ? 1e6 : 1);
  const withSign = /\$\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d+))?\s*(millones?|mdp|mil)?\b/gi;
  for (const m of text.matchAll(withSign)) found.push(toNumber(`${m[1]}.${m[2] || 0}`) * scale(m[3]));
  const withoutSign = /(?<![$\d.,])(\d+(?:\.\d+)?)\s*(millones?|mdp)\b/gi;
  for (const m of text.matchAll(withoutSign)) found.push(Number(m[1]) * 1e6);
  return found.filter((n) => Number.isFinite(n));
}

const numbersBefore = (text, unitPattern) => [...text.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unitPattern})`, "gi"))].map((m) => Number(m[1]));
const AREA_UNIT = "m²|m2|metros cuadrados|mts2?";

// ¿Contradice el texto a la ficha? Devuelve null si está bien o el motivo.
// Solo revisa lo que se puede comprobar sin interpretar: precio, recámaras,
// baños, superficie, teléfonos y enlaces (estos dos últimos los agrega el
// servidor, el modelo no debe escribirlos).
export function factIssue(text, property) {
  if (/https?:\/\/|www\./i.test(text)) return "link";
  if (/(?<!\d)(?:\+?52[\s-]?)?(?:\d[\s().-]?){10}(?!\d)/.test(text.replace(/\d{1,3}(?:,\d{3})+/g, ""))) return "phone";

  const price = num(property.price);
  if (price != null) {
    for (const amount of mentionedPrices(text)) if (Math.abs(amount - price) / price > 0.01) return "price";
  } else if (mentionedPrices(text).length > 0) return "price";

  const bedrooms = num(property.bedrooms);
  for (const n of numbersBefore(text, "rec[aá]maras?|habitaciones?|dormitorios?|cuartos")) if (bedrooms == null || n !== bedrooms) return "bedrooms";

  const bathrooms = num(property.bathrooms);
  const bathOk = bathrooms == null ? [] : [bathrooms, Math.floor(bathrooms)];
  for (const n of numbersBefore(text, "ba[ñn]os?")) if (!bathOk.includes(n)) return "bathrooms";

  // Superficies: la de la ficha o cualquiera que ya esté escrita en la descripción.
  const knownAreas = new Set([num(property.area_m2), ...numbersBefore(String(property.description || ""), AREA_UNIT)].filter((n) => n != null));
  for (const n of numbersBefore(text.replace(/(\d),(?=\d{3})/g, "$1"), AREA_UNIT)) if (!knownAreas.has(n)) return "area";

  return null;
}

const MIN_CHARS = 40;
const MAX_CHARS = { whatsapp: 900, facebook: 1800, instagram: 2200, portal: 2500 };

// Qué se agrega al final de cada texto (lo agrega el servidor, no el modelo):
// el enlace público donde WhatsApp y Facebook lo convierten en vista previa con
// foto, y el contacto de la oficina donde no hay enlace que cliquear.
export function withFooter(text, property, { channel, origin }) {
  const url = propertyUrl(property, origin);
  if (channel === "whatsapp") return `${text}\n\n🔗 ${url}`;
  if (channel === "facebook") return `${text}\n\n🔗 ${url}\n💬 WhatsApp: ${OFFICE_PHONE_TEXT}`;
  if (channel === "instagram") return `${text}\n\n💬 WhatsApp: ${OFFICE_PHONE_TEXT}`;
  return text;
}

// Valida y acota lo que devolvió el modelo (nunca confiar en la forma de un
// JSON ajeno): descarta variantes mal formadas o que contradicen la ficha.
// Devuelve { variants: [{ angle, text }], discarded } listas para mostrar.
export function finalizeVariants(raw, property, { channel, origin }) {
  const list = Array.isArray(raw) ? raw : [];
  const variants = [];
  let discarded = 0;
  for (const item of list.slice(0, 6)) {
    const text = typeof item?.text === "string" ? item.text.trim() : "";
    if (text.length < MIN_CHARS || text.length > (MAX_CHARS[channel] || 2000) || factIssue(text, property)) {
      discarded += 1;
      continue;
    }
    variants.push({ angle: promptSafe(item.angle, 60) || "", text: withFooter(text, property, { channel, origin }) });
  }
  return { variants, discarded };
}
