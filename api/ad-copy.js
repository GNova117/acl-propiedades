// Función serverless: redacta textos de anuncio de una propiedad con Claude
// (ver server/adCopy.js). No guarda los textos: solo registra una fila de uso
// para los topes diarios.
//
// Cada consulta cuesta centavos de dólar, así que aquí se cuida:
//  1. Solo la puede pedir una sesión de Supabase con el apartado 'propiedades'
//     o 'naves_industriales' (no basta con estar logueado), verificado con la
//     función SQL has_admin_section bajo el JWT de quien llama.
//  2. Los datos de la propiedad se leen aquí, de la base, bajo ese mismo JWT:
//     el navegador solo manda el id, nunca los datos que se le entregan a Claude.
//  3. Dos topes por día: por persona (AD_COPY_USER_DAILY_LIMIT, 20) y de todo el
//     equipo (AD_COPY_DAILY_LIMIT, 60), para que nadie se acabe la cuota de los demás.
// La llave ANTHROPIC_API_KEY (la misma de las demás funciones) vive solo en las
// variables de entorno de Vercel.
import { createClient } from "@supabase/supabase-js";
import { AD_CHANNELS, AD_TONES, MAX_EXTRA_CHARS } from "../src/lib/adCopy.js";
import { AdCopyError, DEFAULT_MODEL, writeAdCopy } from "../server/adCopy.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_LIMIT = 60;
const DEFAULT_USER_DAILY_LIMIT = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function validateParams(body) {
  const propertyId = String(body?.propertyId ?? "");
  if (!UUID.test(propertyId)) return null;
  const channel = AD_CHANNELS.includes(body?.channel) ? body.channel : null;
  if (!channel) return null;
  const tone = AD_TONES.includes(body?.tone) ? body.tone : "cercano";
  const extra = String(body?.extra ?? "").trim().slice(0, MAX_EXTRA_CHARS);
  return { propertyId, channel, tone, extra };
}

const HTTP_STATUS_BY_CODE = {
  bad_key: 502,
  rate_limited: 429,
  timeout: 504,
  bad_request: 502,
  refused: 422,
  bad_output: 502,
  upstream: 502,
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method" });
    return;
  }

  const token = (req.headers.authorization || "").startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !key) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  // El cliente lleva el JWT de quien llama: todo lo que se lea o escriba pasa
  // por las mismas políticas RLS que en el panel, sin llave de servicio.
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const [properties, warehouses] = await Promise.all([
    supabase.rpc("has_admin_section", { section: "propiedades" }),
    supabase.rpc("has_admin_section", { section: "naves_industriales" }),
  ]);
  if (properties.data !== true && warehouses.data !== true) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ configured: false });
    return;
  }

  const params = validateParams(parseBody(req));
  if (!params) {
    res.status(400).json({ error: "params" });
    return;
  }

  const { data: property } = await supabase.from("properties").select("*").eq("id", params.propertyId).maybeSingle();
  if (!property) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const email = userData.user.email || "";

  // Primero la tabla (antes de gastar un centavo): si el SQL aún no se corrió,
  // se avisa aquí en vez de pagar una consulta que no se podría contar.
  const { count: teamCount, error: countError } = await supabase.from("ad_copy_usage").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (countError) {
    res.status(503).json({ error: "no_table" });
    return;
  }
  const { count: userCount } = await supabase.from("ad_copy_usage").select("id", { count: "exact", head: true }).gte("created_at", since).eq("created_by", email);

  const teamLimit = Number(process.env.AD_COPY_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const userLimit = Number(process.env.AD_COPY_USER_DAILY_LIMIT) || DEFAULT_USER_DAILY_LIMIT;
  if ((userCount ?? 0) >= userLimit) {
    res.status(429).json({ error: "limit", limit: userLimit, scope: "user" });
    return;
  }
  if ((teamCount ?? 0) >= teamLimit) {
    res.status(429).json({ error: "limit", limit: teamLimit, scope: "team" });
    return;
  }

  // El enlace del anuncio apunta al sitio desde el que se pidió (no a un dominio fijo).
  const origin = (req.headers.origin || `https://${req.headers.host || ""}`).replace(/\/+$/, "");

  let result;
  try {
    result = await writeAdCopy(property, { channel: params.channel, tone: params.tone, extra: params.extra, origin }, { model: process.env.AD_COPY_MODEL || DEFAULT_MODEL });
  } catch (err) {
    const code = err instanceof AdCopyError ? err.code : "upstream";
    res.status(HTTP_STATUS_BY_CODE[code] || 502).json({ error: code, message: err.message });
    return;
  }

  // Se registra el uso aunque falle el guardado (ya se pagó la consulta): solo afecta la exactitud del tope.
  await supabase.from("ad_copy_usage").insert({ created_by: email || null, property_id: property.id, channel: params.channel });

  res.status(200).json({ configured: true, variants: result.variants, usage: result.usage });
}
