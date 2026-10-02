// Tercera función serverless del proyecto (junto a sitemap y analytics-summary).
// Busca en internet los precios de las propiedades en venta de una zona (vía
// Claude con búsqueda web, ver server/marketSearch.js), guarda la consulta
// como una "foto" del mercado (tabla market_snapshots) y la devuelve.
//
// Cada consulta cuesta dinero (centavos de dólar), así que aquí se cuida:
//  1. Solo la puede pedir una sesión de Supabase con el apartado 'valuacion'
//     (no basta con estar logueado), verificado con la función SQL
//     has_admin_section bajo el JWT de quien llama.
//  2. Si ya hay una consulta de la misma zona de las últimas 24 h se devuelve
//     esa, sin gastar nada, salvo que el asesor pida actualizar (`force`).
//  3. Tope de consultas nuevas por día (MARKET_DAILY_LIMIT, por defecto 20).
// La llave ANTHROPIC_API_KEY vive solo en las variables de entorno de Vercel.
import { createClient } from "@supabase/supabase-js";
import { MUNICIPALITIES } from "../src/lib/expenseBreakdown.js";
import { PROPERTY_TYPES, basisFor, summarizeMarket } from "../src/lib/marketStats.js";
import { DEFAULT_MODEL, MarketSearchError, searchMarketComps } from "../server/marketSearch.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_LIMIT = 20;

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

const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : 0;
};

function validateParams(body) {
  // Se quitan % y _ porque la zona se compara con ilike (son comodines).
  const zone = String(body?.zone ?? "").replace(/[%_\r\n]+/g, " ").trim().slice(0, 80);
  if (zone.length < 2) return null;
  const municipality = MUNICIPALITIES.includes(body?.municipality) && body.municipality !== "Otro" ? body.municipality : "Torreón";
  const propertyType = PROPERTY_TYPES.includes(body?.propertyType) ? body.propertyType : "casa";
  return {
    zone,
    municipality,
    propertyType,
    builtArea: positive(body?.builtArea),
    landArea: positive(body?.landArea),
    force: body?.force === true,
  };
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
  const { data: allowed } = await supabase.rpc("has_admin_section", { section: "valuacion" });
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
    res.status(400).json({ error: "zone" });
    return;
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();

  // Primero la tabla (antes de gastar un centavo): si el SQL aún no se corrió,
  // se avisa aquí en vez de pagar una búsqueda que no se podría guardar.
  const { data: recent, error: recentError } = await supabase
    .from("market_snapshots")
    .select("*")
    .ilike("zone_name", params.zone)
    .eq("municipality", params.municipality)
    .eq("property_type", params.propertyType)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (recentError) {
    res.status(503).json({ error: "no_table" });
    return;
  }
  if (recent?.length && !params.force) {
    res.status(200).json({ configured: true, cached: true, snapshot: recent[0] });
    return;
  }

  const limit = Number(process.env.MARKET_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const { count } = await supabase.from("market_snapshots").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= limit) {
    res.status(429).json({ error: "limit", limit });
    return;
  }

  let result;
  try {
    result = await searchMarketComps(params, { model: process.env.MARKET_MODEL || DEFAULT_MODEL });
  } catch (err) {
    const code = err instanceof MarketSearchError ? err.code : "upstream";
    res.status(HTTP_STATUS_BY_CODE[code] || 502).json({ error: code, message: err.message });
    return;
  }

  const basis = basisFor(params.propertyType);
  const summary = summarizeMarket(result.comps, basis);
  const row = {
    created_by: userData.user.email || null,
    zone_name: params.zone,
    municipality: params.municipality,
    property_type: params.propertyType,
    basis,
    comps: result.comps,
    // Sets no se serializan a JSON; la pantalla recalcula todo desde `comps`.
    summary: { total: summary.total, used: summary.used, outliers: summary.outliers, ppm: summary.ppm, medianPrice: summary.medianPrice },
    notes: result.notes || null,
    usage: { ...result.usage, discarded: result.discarded, failedAngles: result.failedAngles },
  };

  const { data: saved, error: saveError } = await supabase.from("market_snapshots").insert(row).select().single();
  if (saveError) {
    // Ya se pagó la búsqueda: se entrega aunque no se haya podido guardar.
    res.status(200).json({ configured: true, cached: false, saved: false, snapshot: { ...row, id: null, created_at: new Date().toISOString() } });
    return;
  }
  res.status(200).json({ configured: true, cached: false, saved: true, snapshot: saved });
}
