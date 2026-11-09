// Plantillas de WhatsApp para dar seguimiento a un prospecto: las situaciones
// más frecuentes del día a día (primer contacto, después de una visita,
// retomar la plática, proponer visita, mandar la propiedad). Funciones puras;
// el texto va al cliente, así que siempre es español sin importar el idioma
// del panel (igual que postsaleMessage). Se pueden editar antes de enviar.

import { formatMXN, whatsappUrl } from "./format";

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// Plantillas de seguimiento por etapa del prospecto: las que conviene mandar
// en cada momento, en el orden en que se sugieren. Las cuatro etapas abiertas
// además ofrecen después las generales (ver BASE_KEYS); las cerradas solo las
// suyas — a quien ya compró no se le manda un "primer contacto".
export const STAGE_TEMPLATE_KEYS = {
  nuevo: ["firstContact", "scheduleVisit", "sendProperty"],
  contactado: ["checkIn", "scheduleVisit", "sendOptions", "sendProperty"],
  interesado: ["thanksVisit", "secondVisit", "creditHelp", "sendProperty"],
  negociacion: ["offerFollowUp", "requestDocuments", "creditHelp"],
  cerrado: ["thanksClosing", "askReferral", "askReview"],
  perdido: ["reactivate", "sendOptions"],
};

const BASE_KEYS = ["firstContact", "thanksVisit", "checkIn", "scheduleVisit", "sendProperty"];
const CLOSED_STAGES = ["cerrado", "perdido"];

// `propertyTitle`: título de la propiedad de interés (si tiene una).
// `propertyUrl`: enlace público a esa propiedad; sin él no se ofrece "enviar la propiedad".
// `advisorName`: asesor responsable, para presentarse en el primer contacto.
//
// Con la etapa del prospecto (prospect.stage), primero van las sugeridas para
// esa etapa (`recommended: true`) y luego las demás generales; sin etapa, las
// cinco generales de siempre.
export function prospectMessageTemplates(prospect, options = {}) {
  const all = allTemplates(prospect, options);
  const byKey = new Map(all.map((tpl) => [tpl.key, tpl]));
  const stageKeys = STAGE_TEMPLATE_KEYS[prospect.stage];
  if (!stageKeys) return BASE_KEYS.filter((key) => byKey.has(key)).map((key) => byKey.get(key));

  const recommended = stageKeys.filter((key) => byKey.has(key)).map((key) => ({ ...byKey.get(key), recommended: true }));
  if (CLOSED_STAGES.includes(prospect.stage)) return recommended;
  const others = BASE_KEYS.filter((key) => byKey.has(key) && !stageKeys.includes(key)).map((key) => ({ ...byKey.get(key), recommended: false }));
  return [...recommended, ...others];
}

function allTemplates(prospect, { propertyTitle, propertyUrl, advisorName } = {}) {
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

  // Las de etapas más avanzadas: segunda visita, crédito, oferta, papeles y,
  // ya cerrado, agradecer, pedir recomendación y reseña; si se perdió, retomar.
  templates.push(
    {
      key: "sendOptions",
      text: `${hello}, ¿sigues buscando propiedad? Tengo opciones nuevas que van con lo que me comentaste. ¿Te las comparto?`,
    },
    {
      key: "secondVisit",
      text: property
        ? `${hello}, si quieres volver a ver ${property} con calma, o con tu familia, con gusto agendamos otra visita. ¿Qué día te acomoda?`
        : `${hello}, si quieres volver a ver la propiedad con calma, o con tu familia, con gusto agendamos otra visita. ¿Qué día te acomoda?`,
    },
    {
      key: "creditHelp",
      text: `${hello}, si vas a usar crédito (Infonavit, Fovissste o bancario), te ayudo sin costo a revisar cuánto te prestan y qué documentos se necesitan. ¿Lo vemos?`,
    },
    {
      key: "offerFollowUp",
      text: property
        ? `${hello}, ¿cómo vas con la propuesta para ${property}? Si tienes dudas del precio o de las condiciones, lo platicamos y vemos cómo avanzar.`
        : `${hello}, ¿cómo vas con la propuesta? Si tienes dudas del precio o de las condiciones, lo platicamos y vemos cómo avanzar.`,
    },
    {
      key: "requestDocuments",
      text: `${hello}, para avanzar${property ? ` con ${property}` : " con el trámite"} vamos a necesitar algunos documentos (INE, CURP, acta de nacimiento y constancia de situación fiscal). Si quieres, te mando un enlace para subirlos desde tu celular.`,
    },
    {
      key: "thanksClosing",
      text: `${hello}, ¡muchas felicidades por tu nueva propiedad! Gracias por confiar en ACL Propiedades. Cualquier cosa que necesites, aquí estoy.`,
    },
    {
      key: "askReferral",
      text: `${hello}, ¿cómo te ha ido? Si conoces a alguien que esté buscando comprar o vender, con gusto le ayudo igual que a ti.`,
    },
    {
      key: "askReview",
      text: `${hello}, ¿nos ayudarías con una reseña en Google sobre tu experiencia con ACL Propiedades? Nos ayuda mucho a que más familias nos conozcan. ¡Gracias!`,
    },
    {
      key: "reactivate",
      text: property
        ? `${hello}, hace un tiempo platicamos sobre ${property}. ¿Sigues buscando propiedad? Tengo opciones nuevas y con gusto te las comparto.`
        : `${hello}, hace un tiempo platicamos sobre tu búsqueda de propiedad. ¿Sigues buscando? Tengo opciones nuevas y con gusto te las comparto.`,
    }
  );

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
