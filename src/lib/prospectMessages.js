// Plantillas de WhatsApp para dar seguimiento a un prospecto: las situaciones
// más frecuentes del día a día (primer contacto, después de una visita,
// retomar la plática, proponer visita, mandar la propiedad). Funciones puras;
// el texto va al cliente, así que siempre es español sin importar el idioma
// del panel (igual que postsaleMessage). Se pueden editar antes de enviar.

import { formatMXN, whatsappUrl } from "./format";

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// `propertyTitle`: título de la propiedad de interés (si tiene una).
// `propertyUrl`: enlace público a esa propiedad; sin él no se ofrece "enviar la propiedad".
// `advisorName`: asesor responsable, para presentarse en el primer contacto.
export function prospectMessageTemplates(prospect, { propertyTitle, propertyUrl, advisorName } = {}) {
  const name = firstName(prospect.name);
  const hello = name ? `Hola ${name}` : "Hola";
  const property = String(propertyTitle || "").trim();
  const intro = advisorName ? `soy ${advisorName} de ACL Propiedades` : "te escribo de ACL Propiedades";

  const templates = [
    {
      key: "firstContact",
      text: property
        ? `${hello}, ${intro}. Vimos tu interés en ${property} y con gusto te doy más información. ¿Cuándo te queda bien que platiquemos?`
        : `${hello}, ${intro}. Recibimos tu solicitud y con gusto te ayudo a encontrar lo que buscas. ¿Qué día y horario te quedan bien para platicar?`,
    },
    {
      key: "thanksVisit",
      text: property
        ? `${hello}, gracias por tu tiempo en la visita a ${property}. ¿Qué te pareció? Con gusto resuelvo cualquier duda o te muestro otras opciones.`
        : `${hello}, gracias por tu tiempo en la visita. ¿Qué te pareció? Con gusto resuelvo cualquier duda o te muestro otras opciones.`,
    },
    {
      key: "checkIn",
      text: property
        ? `${hello}, ¿cómo estás? ¿Pudiste revisar ${property}? Si tienes dudas o quieres que agendemos otra visita, aquí estoy.`
        : `${hello}, ¿cómo estás? ¿Sigues buscando propiedad? Si quieres, te comparto opciones nuevas que se ajusten a lo que necesitas.`,
    },
    {
      key: "scheduleVisit",
      text: property
        ? `${hello}, ¿te gustaría que agendemos una visita a ${property}? Dime qué día y horario te acomodan y lo coordino.`
        : `${hello}, ¿te gustaría que agendemos una visita para conocer alguna propiedad? Dime qué día y horario te acomodan y lo coordino.`,
    },
  ];

  if (propertyUrl) {
    templates.push({
      key: "sendProperty",
      text: `${hello}, te comparto la información${property ? ` de ${property}` : " de la propiedad"}: ${propertyUrl}\nCualquier duda, con gusto te ayudo.`,
    });
  }

  return templates;
}

// Mensaje para sugerirle a un prospecto una propiedad que encaja con lo que busca.
export function suggestPropertyMessage(prospect, property, propertyUrl) {
  const name = firstName(prospect.name);
  const hello = name ? `Hola ${name}` : "Hola";
  const where = property.zone ? ` en ${property.zone}` : "";
  return `${hello}, encontré una propiedad que va con lo que buscas: ${property.title}${where}, ${formatMXN(property.price)}.\nAquí puedes ver los detalles: ${propertyUrl}\n¿Te gustaría visitarla?`;
}

// A dónde mandar un texto al prospecto: WhatsApp si tiene teléfono, si no su
// correo, y null si no hay ninguno de los dos.
export function sendLink(prospect, text, emailSubject) {
  const whatsapp = whatsappUrl(prospect.phone, text);
  if (whatsapp) return whatsapp;
  const email = String(prospect.email || "").trim();
  return email ? `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(text)}` : null;
}
