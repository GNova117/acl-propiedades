// Cuarta función serverless del proyecto (junto a sitemap, analytics-summary
// y market-comps). Lee la foto de un croquis a mano (vía Claude con visión,
// ver server/sketchToPlan.js) y devuelve un borrador de cuartos para el
// Editor de Construcción — nada se guarda (ni la imagen ni el resultado),
// salvo una fila de uso para el tope diario.
//
// Cada consulta cuesta dinero (menos que Mercado en internet: sin búsqueda
// web), así que aquí se cuida igual:
//  1. Solo la puede pedir una sesión de Supabase con el apartado
//     'construccion' (no basta con estar logueado), verificado con la
//     función SQL has_admin_section bajo el JWT de quien llama.
//  2. Tope de consultas nuevas por día (SKETCH_DAILY_LIMIT, por defecto 20).
// La llave ANTHROPIC_API_KEY (la misma que usa market-comps) vive solo en las
// variables de entorno de Vercel.
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_MODEL, SketchToPlanError, sketchToPlan } from "../server/sketchToPlan.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_LIMIT = 20;
// Base64 de una imagen ya comprimida en el cliente (máx. 1920px, JPEG ~calidad 0.82) —
// de sobra para leer un croquis, y deja el cuerpo de la petición muy por debajo del
// límite de Vercel. Este tope es solo una red de seguridad contra un payload fuera de lugar.
const MAX_IMAGE_BASE64_CHARS = 8_000_000;

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

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateParams(body) {
  const mediaType = String(body?.mediaType ?? "");
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) return null;
  const imageBase64 = String(body?.imageBase64 ?? "");
  if (imageBase64.length < 100 || imageBase64.length > MAX_IMAGE_BASE64_CHARS) return null;
  return { mediaType, imageBase64 };
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
  const { data: allowed } = await supabase.rpc("has_admin_section", { section: "construccion" });
  if (allowed !== true) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ configured: false });
    return;
  }

  const params = validateParams(parseBody(req));
  if (!params) {
    res.status(400).json({ error: "image" });
    return;
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();

  // Primero la tabla (antes de gastar un centavo): si el SQL aún no se corrió,
  // se avisa aquí en vez de pagar una consulta que no se podría contar.
  const { count, error: countError } = await supabase
    .from("construccion_sketch_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (countError) {
    res.status(503).json({ error: "no_table" });
    return;
  }

  const limit = Number(process.env.SKETCH_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  if ((count ?? 0) >= limit) {
    res.status(429).json({ error: "limit", limit });
    return;
  }

  let result;
  try {
    result = await sketchToPlan(params, { model: process.env.SKETCH_MODEL || DEFAULT_MODEL });
  } catch (err) {
    const code = err instanceof SketchToPlanError ? err.code : "upstream";
    res.status(HTTP_STATUS_BY_CODE[code] || 502).json({ error: code, message: err.message });
    return;
  }

  // Se registra el uso aunque falle el guardado (ya se pagó la consulta): no es crítico si
  // esta fila no queda, solo afecta la exactitud del tope diario.
  await supabase.from("construccion_sketch_usage").insert({ created_by: userData.user.email || null });

  res.status(200).json({ configured: true, habitaciones: result.habitaciones, usage: result.usage });
}
