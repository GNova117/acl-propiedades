// Chat del sitio público (widget que reemplaza al botón flotante de
// WhatsApp — ver src/components/ChatWidget.jsx). A diferencia de
// api/market-comps.js, esta función es PÚBLICA: cualquier visitante la
// llama sin sesión de Supabase. Por eso:
//  1. Las propiedades se leen con la llave anon (son públicas de por sí).
//  2. Guardar un lead (prospectos) sí necesita SUPABASE_SERVICE_ROLE_KEY —
//     un visitante nunca tiene permiso para insertar ahí directo.
//  3. chat_rate_limits (misma llave de servicio) limita abuso: por sesión de
//     chat (un UUID que genera el navegador) y en total por día.
// La llave ANTHROPIC_API_KEY vive solo en las variables de entorno de Vercel.
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { CHAT_LIMITS, clientIp, validateIncomingMessages } from "../src/lib/chatbot.js";
import { ChatbotError, DEFAULT_MODEL, runChat } from "../server/chatbot.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROPERTIES_FETCHED = 8;

const HTTP_STATUS_BY_CODE = {
  bad_key: 502,
  rate_limited: 429,
  timeout: 504,
  bad_request: 502,
  refused: 422,
  too_many_turns: 502,
  upstream: 502,
};

function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body && typeof req.body === "object" ? req.body : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ configured: false });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    res.status(200).json({ configured: false });
    return;
  }

  const body = parseBody(req);
  const sessionId = String(body?.sessionId ?? "");
  if (!UUID_PATTERN.test(sessionId)) {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  const messages = validateIncomingMessages(body?.messages);
  if (!messages) {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Límites de abuso/gasto — se revisan ANTES de llamar a Claude.
  const hourAgo = new Date(Date.now() - HOUR_MS).toISOString();
  const dayAgo = new Date(Date.now() - DAY_MS).toISOString();
  const [{ count: sessionCount, error: sessionErr }, { count: dailyCount, error: dailyErr }] = await Promise.all([
    service.from("chat_rate_limits").select("id", { count: "exact", head: true }).eq("session_id", sessionId).gte("created_at", hourAgo),
    service.from("chat_rate_limits").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
  ]);
  if (sessionErr || dailyErr) {
    res.status(503).json({ error: "no_table" });
    return;
  }
  const sessionLimit = Number(process.env.CHAT_SESSION_HOURLY_LIMIT) || CHAT_LIMITS.sessionHourlyLimit;
  const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT) || CHAT_LIMITS.dailyLimit;
  if ((sessionCount ?? 0) >= sessionLimit || (dailyCount ?? 0) >= dailyLimit) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  // Tope por IP (guardada como huella con la llave de servicio, no en claro): rotar el id de sesión no basta
  // para agotar el cupo de todos. Si la columna ip_hash aún no existe (falta correr el SQL), este tope se
  // omite y todo sigue como antes.
  const ip = clientIp(req.headers);
  const ipHash = ip ? createHmac("sha256", serviceKey).update(ip).digest("hex") : null;
  if (ipHash) {
    const ipHourlyLimit = Number(process.env.CHAT_IP_HOURLY_LIMIT) || CHAT_LIMITS.ipHourlyLimit;
    const ipDailyLimit = Number(process.env.CHAT_IP_DAILY_LIMIT) || CHAT_LIMITS.ipDailyLimit;
    const [{ count: ipHourly, error: ipHourlyErr }, { count: ipDaily, error: ipDailyErr }] = await Promise.all([
      service.from("chat_rate_limits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo),
      service.from("chat_rate_limits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", dayAgo),
    ]);
    if (!ipHourlyErr && !ipDailyErr && ((ipHourly ?? 0) >= ipHourlyLimit || (ipDaily ?? 0) >= ipDailyLimit)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
  }

  // Se cuenta el intento aunque la respuesta falle más abajo: es justo lo
  // que este límite debe frenar (y evita pagar dos veces el conteo).
  const { error: logError } = await service.from("chat_rate_limits").insert({ session_id: sessionId, ip_hash: ipHash });
  if (logError) await service.from("chat_rate_limits").insert({ session_id: sessionId }); // sin la columna ip_hash todavía

  const searchProperties = async (args) => {
    let query = anon.from("properties").select("code, title, price, zone, bedrooms, area_m2, type, operation_type").eq("active", true).limit(MAX_PROPERTIES_FETCHED);
    if (args.type) query = query.eq("type", args.type);
    if (args.operation) query = query.eq("operation_type", args.operation);
    if (args.zone) query = query.ilike("zone", `%${args.zone}%`);
    if (args.minPrice != null) query = query.gte("price", args.minPrice);
    if (args.maxPrice != null) query = query.lte("price", args.maxPrice);
    if (args.minBedrooms != null) query = query.gte("bedrooms", args.minBedrooms);
    const { data, error } = await query;
    return error ? [] : data || [];
  };

  const onLead = async (lead) => {
    const { error } = await service.from("prospectos").insert({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: "chatbot",
      stage: "nuevo",
      looking_for: lead.interest,
      created_by: "chatbot",
    });
    // Si no se guardó, que falle la herramienta: el modelo recibe el error y NO le dice a la persona "ya quedó
    // registrado" cuando el prospecto se perdió (ver runTool en server/chatbot.js).
    if (error) throw new Error("No se pudo guardar el prospecto");
  };

  // Agendar visitas desde el chat: el código de la propiedad (el que ve en los resultados) se resuelve aquí y las
  // reglas de horarios, límites y correos son las de siempre (get_visit_slots / book_visit de schema.sql). Si esas
  // funciones aún no existen en la base, el chat responde que no hay horarios en línea y pasa a un asesor.
  const findPropertyId = async (code) => {
    const { data } = await anon.from("properties").select("id").eq("code", code).eq("active", true).maybeSingle();
    return data?.id || null;
  };
  const listVisitSlots = async (code) => {
    const id = await findPropertyId(code);
    if (!id) return null;
    const { data, error } = await anon.rpc("get_visit_slots", { p_property_id: id, p_from: null, p_days: 14 });
    return error ? [] : data?.slots || [];
  };
  const bookVisit = async (visit) => {
    const id = await findPropertyId(visit.code);
    if (!id) return null;
    const { data, error } = await anon.rpc("book_visit", {
      p_property_id: id,
      p_fecha: visit.fecha,
      p_hora: visit.hora,
      p_name: visit.name,
      p_email: visit.email,
      p_phone: visit.phone,
      p_note: visit.note,
    });
    return error ? { error: "upstream" } : data;
  };

  try {
    const result = await runChat(
      { messages, searchProperties, onLead, listVisitSlots, bookVisit },
      { model: process.env.CHAT_MODEL || DEFAULT_MODEL }
    );
    res.status(200).json({ configured: true, reply: result.reply, leadCaptured: result.leadCaptured, handoff: result.handoff, visitBooked: result.visitBooked });
  } catch (err) {
    const code = err instanceof ChatbotError ? err.code : "upstream";
    // El detalle del proveedor (llave, cuotas, mensajes de Anthropic) se queda en los registros del servidor;
    // al visitante solo le llega un código genérico.
    console.error("chat", code, err?.message);
    res.status(HTTP_STATUS_BY_CODE[code] || 502).json({ error: code });
  }
}
