// Lógica pura del chatbot público (widget de chat que reemplaza al botón
// flotante de WhatsApp — ver src/components/ChatWidget.jsx). Todo lo que no
// necesita la llave de Anthropic ni Supabase vive aquí para poder probarse
// con vitest; la llamada real a Claude (el loop de herramientas) vive en
// server/chatbot.js, que importa estas mismas piezas.
import { OFFICE_WHATSAPP } from "./office.js";
import { formatMXN } from "./format.js";

export const CHAT_MODEL_DEFAULT = "claude-haiku-5-5";

export const OFFICE_INFO = {
  phone: "871 324 3271",
  whatsapp: OFFICE_WHATSAPP,
  email: "inmobiliaria@aclpropiedades.com",
  address: "Blvd. Independencia, Local 16, Plaza San Luciano, Torreón, Coahuila",
  zones: "Torreón, Gómez Palacio y Lerdo (La Comarca Lagunera)",
};

export const PROPERTY_SEARCH_TYPES = ["casa", "departamento", "terreno", "nave_industrial"];
export const PROPERTY_SEARCH_OPERATIONS = ["compra", "renta"];
const TYPE_LABELS = { casa: "casas", departamento: "departamentos", terreno: "terrenos", nave_industrial: "naves industriales" };

// Topes defensivos contra un payload armado a mano para gastar de más en una
// sola llamada (la conversación se reenvía completa en cada turno porque no
// se guarda en el servidor — ver api/chat.js). No son el límite de abuso por
// sesión/día (eso vive en chat_rate_limits, una fila por llamada a la API);
// esto acota el tamaño de UNA llamada.
export const CHAT_LIMITS = {
  maxMessages: 40,
  maxMessageChars: 2000,
  maxTotalChars: 12000,
  sessionHourlyLimit: 30,
  dailyLimit: 500,
};

export function buildSystemPrompt() {
  return `Eres el asistente virtual de ACL Propiedades, una inmobiliaria en ${OFFICE_INFO.zones}. Ayudas a quien visita el sitio a encontrar propiedades y resuelves dudas generales sobre comprar, vender o rentar.

Datos de la oficina (solo los usas si te los piden, no los repitas sin que venga al caso):
- Dirección: ${OFFICE_INFO.address}
- Teléfono/WhatsApp: ${OFFICE_INFO.phone}
- Correo: ${OFFICE_INFO.email}

Reglas:
- Responde en español, breve y claro (2-4 oraciones por mensaje, nada de párrafos largos). Usa el mismo idioma en que te escriban si no es español.
- Para preguntas sobre propiedades disponibles, precios o inventario, SIEMPRE usa la herramienta buscar_propiedades en vez de inventar datos — nunca inventes una propiedad, precio o dirección que no venga de esa herramienta.
- Si la persona muestra interés real (quiere que la contacten, agendar una visita, más información de una propiedad específica), usa la herramienta capturar_lead para guardar su nombre y teléfono o correo. Pídeselos de forma natural dentro de la conversación, no como un formulario.
- Nunca inventes información legal, de crédito o de trámites específica (tasas, requisitos exactos de INFONAVIT, montos de escrituración). Para eso, invita a usar la calculadora/simulador del sitio o a hablar con un asesor.
- Si no puedes resolver algo, si la persona lo pide explícitamente, o si la conversación se está complicando, dile con naturalidad que puede escribirle directo a un asesor por WhatsApp (el botón ya está visible en el chat, no hace falta que des el número).
- Nunca pidas contraseñas, datos bancarios completos ni documentos de identidad por este chat.`;
}

export const CHAT_TOOLS = [
  {
    name: "buscar_propiedades",
    description: "Busca propiedades disponibles en el inventario real de ACL Propiedades. Úsala siempre que te pregunten por propiedades, precios o disponibilidad.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: PROPERTY_SEARCH_OPERATIONS, description: "compra o renta" },
        tipo: { type: "string", enum: PROPERTY_SEARCH_TYPES },
        zona: { type: "string", description: "Zona o colonia, texto libre (ej. 'Gómez Palacio', 'Las Fuentes')" },
        precio_min: { type: "number" },
        precio_max: { type: "number" },
        recamaras_min: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "capturar_lead",
    description: "Guarda los datos de contacto de alguien interesado para que un asesor le dé seguimiento. Requiere al menos teléfono o correo.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        telefono: { type: "string" },
        correo: { type: "string" },
        interes: { type: "string", description: "Qué busca o en qué propiedad está interesado, en una frase" },
      },
      required: ["nombre"],
      additionalProperties: false,
    },
  },
];

const clampNumber = (value, { min = 0, max = Infinity } = {}) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

// Limpia lo que llega de la herramienta buscar_propiedades antes de tocar la
// base de datos — mismo criterio que validateParams() en los demás api/*.js.
export function normalizePropertySearchArgs(args) {
  const operation = PROPERTY_SEARCH_OPERATIONS.includes(args?.operacion) ? args.operacion : undefined;
  const type = PROPERTY_SEARCH_TYPES.includes(args?.tipo) ? args.tipo : undefined;
  const zone = String(args?.zona ?? "").replace(/[%_\r\n]+/g, " ").trim().slice(0, 80) || undefined;
  return {
    operation,
    type,
    zone,
    minPrice: clampNumber(args?.precio_min, { min: 0, max: 1_000_000_000 }),
    maxPrice: clampNumber(args?.precio_max, { min: 0, max: 1_000_000_000 }),
    minBedrooms: clampNumber(args?.recamaras_min, { min: 0, max: 20 }),
  };
}

const MAX_PROPERTIES_IN_REPLY = 5;

// Formato corto a propósito: cada propiedad que el modelo "ve" cuesta
// tokens de entrada en el siguiente turno.
export function summarizePropertiesForChat(properties) {
  if (!properties || properties.length === 0) {
    return "No se encontraron propiedades activas con esos filtros.";
  }
  const lines = properties.slice(0, MAX_PROPERTIES_IN_REPLY).map((p) => {
    const bits = [p.code, p.title, formatMXN(p.price), p.zone, p.bedrooms ? `${p.bedrooms} recámaras` : null, p.area_m2 ? `${p.area_m2} m²` : null];
    return `- ${bits.filter(Boolean).join(" · ")}`;
  });
  const extra = properties.length > MAX_PROPERTIES_IN_REPLY ? `\n(hay ${properties.length - MAX_PROPERTIES_IN_REPLY} más que no se muestran; sugiere afinar la búsqueda si hace falta)` : "";
  return `${lines.join("\n")}${extra}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Entra tal cual lo mandó la herramienta capturar_lead: nombre es
// obligatorio y hace falta al menos un dato de contacto real. Devuelve null
// si no alcanza — quien llama le contesta al modelo que falta un dato, en
// vez de guardar un prospecto inservible.
export function validateLeadArgs(args) {
  const name = String(args?.nombre ?? "").trim().slice(0, 120);
  if (!name) return null;
  const phoneDigits = String(args?.telefono ?? "").replace(/\D/g, "");
  const phone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : null;
  const emailRaw = String(args?.correo ?? "").trim().toLowerCase();
  const email = EMAIL_PATTERN.test(emailRaw) ? emailRaw : null;
  if (!phone && !email) return null;
  return {
    name,
    phone,
    email,
    interest: String(args?.interes ?? "").trim().slice(0, 300) || null,
  };
}

// Valida/acota la conversación que manda el navegador (se reenvía completa
// en cada turno — no hay historial guardado en el servidor).
export function validateIncomingMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > CHAT_LIMITS.maxMessages) return null;
  let totalChars = 0;
  const cleaned = [];
  for (const m of messages) {
    if (m?.role !== "user" && m?.role !== "assistant") return null;
    const content = String(m?.content ?? "").trim();
    if (!content || content.length > CHAT_LIMITS.maxMessageChars) return null;
    totalChars += content.length;
    cleaned.push({ role: m.role, content });
  }
  if (totalChars > CHAT_LIMITS.maxTotalChars) return null;
  if (cleaned[cleaned.length - 1].role !== "user") return null;
  return cleaned;
}

export function whatsappHref(message) {
  return `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(message || "Hola, quiero más información.")}`;
}

// Tope generoso pero no ilimitado: wa.me no trunca el texto, pero un
// prellenado kilométrico es igual de inútil para el asesor que uno vacío —
// se queda con los turnos más RECIENTES (los más relevantes) hasta llenarlo.
const WHATSAPP_HANDOFF_MAX_CHARS = 700;

// Cuando el chatbot no pudo resolver algo y la persona pasa a WhatsApp, el
// mensaje prellenado lleva el resumen de lo que ya platicó — para que el
// asesor no le pregunte desde cero lo que el bot ya sabía.
export function buildWhatsappHandoffMessage(messages) {
  const cleaned = (Array.isArray(messages) ? messages : []).filter((m) => m?.role === "user" || m?.role === "assistant");
  if (cleaned.length === 0) return undefined;

  const lines = [];
  let total = 0;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    const content = String(cleaned[i].content ?? "").trim();
    if (!content) continue;
    const line = `${cleaned[i].role === "user" ? "Yo" : "Asistente"}: ${content}`;
    if (total + line.length > WHATSAPP_HANDOFF_MAX_CHARS) break;
    lines.unshift(line);
    total += line.length + 1;
  }
  if (lines.length === 0) return undefined;

  return `Hola, vengo del chat del sitio y quiero continuar con un asesor. Esto es lo que ya platiqué:\n\n${lines.join("\n")}`;
}

export const typeLabel = (type) => TYPE_LABELS[type] || type;
