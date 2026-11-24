// Lógica pura del chatbot público (widget de chat que reemplaza al botón
// flotante de WhatsApp — ver src/components/ChatWidget.jsx). Todo lo que no
// necesita la llave de Anthropic ni Supabase vive aquí para poder probarse
// con vitest; la llamada real a Claude (el loop de herramientas) vive en
// server/chatbot.js, que importa estas mismas piezas.
import { OFFICE, OFFICE_WHATSAPP } from "./office.js";
import { formatMXN } from "./format.js";
import { addDays, bookingFieldErrors, hhmm, mexicoParts, weekdayOf } from "./visitSlots.js";

export const CHAT_MODEL_DEFAULT = "claude-haiku-5-5";

export const OFFICE_INFO = {
  phone: OFFICE.phoneDisplay,
  whatsapp: OFFICE_WHATSAPP,
  email: OFFICE.email,
  address: `${OFFICE.addressShort}, ${OFFICE.addressCity}`,
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
  // Por IP, además del tope por sesión: el id de sesión lo genera el navegador y se rota gratis, así que solo
  // con él un script agotaba el cupo diario de todos. Holgados a propósito: en las redes celulares muchas
  // personas comparten una misma IP pública.
  ipHourlyLimit: 80,
  ipDailyLimit: 200,
};

// IP del visitante según los encabezados que pone Vercel (x-forwarded-for: la primera es la del cliente;
// x-real-ip de respaldo). `headers` es el objeto de Node (llaves en minúsculas). Nulo si no hay una IP válida.
export function clientIp(headers = {}) {
  const forwarded = String(headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  const candidate = forwarded || String(headers["x-real-ip"] ?? "").trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate.toLowerCase() : null;
}

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
- Para AGENDAR UNA VISITA a una propiedad: primero consulta horarios_visita con su código (lo ves en los resultados de buscar_propiedades); ofrece 2 o 3 horarios de los que devuelva, NUNCA inventes uno. Cuando la persona elija uno, pídele (si aún no los tienes) nombre completo, correo y teléfono, confírmale el resumen y SOLO entonces usa agendar_visita. Si la propiedad no tiene horarios en línea, o agendar_visita falla dos veces, usa pasar_a_asesor.
- Usa pasar_a_asesor cuando la persona pida hablar con un asesor o una persona, cuando no puedas resolver lo que necesita o cuando la conversación se complique. Avísale con naturalidad que un asesor le escribirá y que también puede seguir por WhatsApp desde el botón del chat.
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
  {
    name: "horarios_visita",
    description: "Consulta los próximos horarios libres para visitar una propiedad (por su código, ej. ACL-12). Úsala antes de ofrecer una visita; solo ofrece horarios que esta herramienta devuelva.",
    input_schema: {
      type: "object",
      properties: { codigo: { type: "string", description: "Código de la propiedad, tal como aparece en los resultados de buscar_propiedades" } },
      required: ["codigo"],
      additionalProperties: false,
    },
  },
  {
    name: "agendar_visita",
    description: "Agenda una visita en uno de los horarios que devolvió horarios_visita. Requiere nombre, correo y teléfono reales que la persona te dio; confirma el resumen con ella antes de usarla. Le llega un correo con el enlace para cambiarla o cancelarla.",
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string" },
        fecha: { type: "string", description: "AAAA-MM-DD, exactamente como la devolvió horarios_visita" },
        hora: { type: "string", description: "HH:MM, exactamente como la devolvió horarios_visita" },
        nombre: { type: "string" },
        correo: { type: "string" },
        telefono: { type: "string" },
        nota: { type: "string", description: "Algo que la persona quiera que el asesor sepa (opcional)" },
      },
      required: ["codigo", "fecha", "hora", "nombre", "correo", "telefono"],
      additionalProperties: false,
    },
  },
  {
    name: "pasar_a_asesor",
    description: "Marca que la persona necesita a un asesor humano (lo pidió, no pudiste resolverlo o la conversación se complicó). Si te dio teléfono o correo, también se guarda para que un asesor le escriba.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "En una frase, qué necesita o por qué pasa a un asesor" },
        nombre: { type: "string" },
        telefono: { type: "string" },
        correo: { type: "string" },
      },
      required: ["motivo"],
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


// ── Agendar visitas desde el chat ──
const PROPERTY_CODE = /^[A-Za-z0-9-]{2,30}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^\d{1,2}:\d{2}$/;
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const CHAT_MAX_SLOT_DAYS = 4; // cuántos días de horarios se le muestran al modelo (cada uno cuesta tokens)
export const CHAT_MAX_SLOTS_PER_DAY = 6;

// Código de propiedad limpio y en mayúsculas, o null (nunca se arma una consulta con texto libre).
export function normalizePropertyCode(value) {
  const code = String(value ?? "").trim();
  return PROPERTY_CODE.test(code) ? code.toUpperCase() : null;
}

// Lo que la base devuelve en get_visit_slots → texto corto para el modelo: un renglón por día.
export function summarizeSlotsForChat(slots, { property } = {}) {
  const list = Array.isArray(slots) ? slots : [];
  if (list.length === 0) {
    return "Esa propiedad no tiene horarios para visitar en línea por ahora. No inventes uno: usa pasar_a_asesor para que un asesor la agende.";
  }
  const byDate = new Map();
  for (const slot of list) {
    if (!slot?.fecha || !slot?.hora) continue;
    byDate.set(slot.fecha, [...(byDate.get(slot.fecha) || []), hhmm(slot.hora)]);
  }
  const lines = [...byDate.entries()].slice(0, CHAT_MAX_SLOT_DAYS).map(([fecha, horas]) => {
    const more = horas.length > CHAT_MAX_SLOTS_PER_DAY ? ` (+${horas.length - CHAT_MAX_SLOTS_PER_DAY} más)` : "";
    return `- ${WEEKDAYS[weekdayOf(fecha)]} ${fecha}: ${horas.slice(0, CHAT_MAX_SLOTS_PER_DAY).join(", ")}${more}`;
  });
  return `${property ? `Horarios libres para ${property}:\n` : "Horarios libres:\n"}${lines.join("\n")}\nOfrece solo estos horarios. Al agendar usa fecha y hora exactamente como aparecen.`;
}

// Argumentos de agendar_visita → { value } listo para book_visit o { error } en texto para el modelo.
// Mismas reglas de nombre/correo/teléfono que la base (bookingFieldErrors); el horario lo valida la base.
export function validateBookingArgs(args, now = new Date()) {
  const code = normalizePropertyCode(args?.codigo);
  if (!code) return { error: "Falta el código de la propiedad (el de buscar_propiedades)." };
  const fecha = String(args?.fecha ?? "").trim();
  const hora = String(args?.hora ?? "").trim();
  if (!DATE_ONLY.test(fecha) || !TIME_ONLY.test(hora)) return { error: "La fecha debe ser AAAA-MM-DD y la hora HH:MM, tal como las devolvió horarios_visita." };
  const today = mexicoParts(now).date;
  if (fecha < today || fecha > addDays(today, 60)) return { error: "Esa fecha no es válida; elige uno de los horarios que devolvió horarios_visita." };
  const errors = bookingFieldErrors({ name: args?.nombre, email: args?.correo, phone: args?.telefono, note: args?.nota });
  const missing = [errors.name && "nombre completo", errors.email && "correo válido", errors.phone && "teléfono de 10 dígitos", errors.note && "nota más corta (máx. 500 caracteres)"].filter(Boolean);
  if (missing.length > 0) return { error: `Faltan o son inválidos: ${missing.join(", ")}. Pídeselos a la persona; no los inventes.` };
  return {
    value: {
      code,
      fecha,
      hora: hhmm(hora),
      name: String(args.nombre).trim(),
      email: String(args.correo).trim().toLowerCase(),
      phone: String(args.telefono).trim(),
      note: String(args?.nota ?? "").trim() || null,
    },
  };
}

const BOOKING_ERRORS = {
  invalid_name: "El nombre no es válido; pídeselo completo.",
  invalid_email: "El correo no es válido; pídeselo de nuevo.",
  invalid_phone: "El teléfono no es válido; necesita 10 dígitos.",
  invalid_note: "La nota es demasiado larga.",
  invalid_slot: "Ese horario no es válido; consulta horarios_visita y ofrece otro.",
  slot_unavailable: "Ese horario ya no está libre. Consulta horarios_visita otra vez y ofrece otro.",
  property_unavailable: "Esa propiedad ya no está disponible para visitas.",
  rate_limited: "Se hicieron muchas solicitudes seguidas. Pídele que espere unos minutos o usa pasar_a_asesor.",
  too_many_active: "Esa persona ya tiene visitas activas desde el sitio; usa pasar_a_asesor para que un asesor lo resuelva.",
};

// Respuesta de book_visit → { text, booked }. Nunca se le da al modelo el enlace privado de la visita (le llega por correo).
export function summarizeBookingResult(result) {
  if (result?.ok) {
    return { booked: true, text: `Visita agendada para el ${result.fecha} a las ${hhmm(result.hora)}. Le llegó un correo de confirmación con el enlace para cambiarla o cancelarla. Confírmaselo con naturalidad.` };
  }
  return { booked: false, text: BOOKING_ERRORS[result?.error] || "No se pudo agendar. Ofrece otro horario o usa pasar_a_asesor." };
}

// Argumentos de pasar_a_asesor → { reason, lead } (lead solo si dejó un dato de contacto real).
export function validateHandoffArgs(args) {
  const reason = String(args?.motivo ?? "").trim().slice(0, 200) || "Pide hablar con un asesor";
  const lead = validateLeadArgs({ nombre: args?.nombre || "Contacto del chat", telefono: args?.telefono, correo: args?.correo, interes: `PIDE UN ASESOR: ${reason}` });
  return { reason, lead };
}
