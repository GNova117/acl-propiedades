// Mensajes para mandar propiedades a un cliente por WhatsApp: una sola
// propiedad (botón "Enviar" de Propiedades) o varias en el mismo mensaje (las
// que le encajan a un prospecto). Funciones puras; el texto va al cliente, así
// que siempre es español sin importar el idioma del panel. WhatsApp arma la
// vista previa con foto desde el enlace público de la propiedad, por eso el
// mensaje lleva el enlace y no la imagen.

import { formatMXN } from "./format";
import { propertyUrl, specsLine } from "./socialPost";

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

const hello = (name) => (firstName(name) ? `Hola ${firstName(name)}` : "Hola");

const priceText = (property) => `${formatMXN(property.price)}${property.operation_type === "renta" ? " al mes" : ""}`;

function propertyBlock(property, origin) {
  return [
    `🏡 ${String(property.title || "").trim()}${property.code ? ` (${property.code})` : ""}`,
    property.zone ? `📍 ${property.zone}` : null,
    `💰 ${priceText(property)}`,
    specsLine(property) || null,
    `🔗 ${propertyUrl(property, origin)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// `recipientName`: a quién va (puede ir vacío: "Hola,"). `advisorName`: firma opcional.
export function propertyShareMessage(property, { origin, recipientName = "", advisorName = "" } = {}) {
  const sign = advisorName ? `\n— ${advisorName}, ACL Propiedades` : "";
  return `${hello(recipientName)}, te comparto esta propiedad:\n\n${propertyBlock(property, origin)}\n\n¿Te gustaría visitarla? Con gusto coordino el recorrido.${sign}`;
}

// Varias propiedades en un solo mensaje (máximo `limit`, para que no sea eterno).
export function propertiesShareMessage(properties, { origin, recipientName = "", advisorName = "", limit = 3 } = {}) {
  const list = properties.slice(0, limit);
  if (list.length === 0) return "";
  if (list.length === 1) return propertyShareMessage(list[0], { origin, recipientName, advisorName });
  const sign = advisorName ? `\n— ${advisorName}, ACL Propiedades` : "";
  const blocks = list.map((p, i) => `${i + 1}. ${propertyBlock(p, origin)}`).join("\n\n");
  return `${hello(recipientName)}, encontré estas propiedades que van con lo que buscas:\n\n${blocks}\n\n¿Cuál te gustaría visitar? Con gusto coordino el recorrido.${sign}`;
}
