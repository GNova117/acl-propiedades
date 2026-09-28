// Se ejecuta cada hora (vía pg_cron, ver el bloque "Alertas de propiedades por
// WhatsApp" en schema.sql) y manda los avisos que las personas pidieron en el
// sitio: (a) hay una propiedad nueva que coincide con su búsqueda guardada y
// (b) bajó de precio una propiedad que les interesó. Usa la plantilla de WhatsApp
// "alerta_propiedad" (hay que crearla y aprobarla en Meta Business Manager; el
// texto sugerido está en schema.sql). Solo manda entre 8 am y 8 pm hora de
// México. Corre con la service role key: lee las alertas y las propiedades de
// todos.
//
// La lógica de qué avisar está en funciones puras y exportadas para poder probarlas
// fuera de Deno; el servidor solo arranca dentro de Deno. La coincidencia de
// criterios está duplicada en src/lib/alertMatch.js (el sitio la usa para decir
// "hoy hay N propiedades que coinciden"); las pruebas comparan ambas.

const GRAPH_VERSION = "v25.0";
const DEFAULT_SITE_URL = "https://acl-propiedades.com";
const MAX_ITEMS_IN_MESSAGE = 3;
const MAX_ALERTS_PER_RUN = 200;

export type Alert = {
  id: string;
  kind: "search" | "price";
  name: string;
  phone: string;
  criteria: Record<string, unknown> | null;
  property_id: string | null;
  price_at_subscribe: number | null;
  active: boolean;
  unsubscribe_token: string;
  created_at: string;
};

export type Property = {
  id: string;
  title: string;
  zone?: string | null;
  type?: string | null;
  operation_type?: string | null;
  tipo_nave?: string | null;
  price: number;
  area_m2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  amenities?: string[] | null;
  active?: boolean | null;
  status?: string | null;
  created_at: string;
};

export type Delivery = { alert_id: string; property_id: string; kind: string; price: number | null };

const num = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const isAvailable = (p: Property): boolean => p.active !== false && (p.status ?? "disponible") === "disponible";

// ¿La propiedad cumple los filtros de la búsqueda guardada? Criterios vacíos = todo.
export function matchesCriteria(p: Property, raw: Record<string, unknown> | null): boolean {
  const c = raw || {};
  const eq = (want: unknown, have: unknown) => !want || String(want) === String(have ?? "");
  if (!eq(c.type, p.type) || !eq(c.operation_type, p.operation_type) || !eq(c.tipo_nave, p.tipo_nave) || !eq(c.zone, p.zone)) return false;
  const price = Number(p.price) || 0;
  const minPrice = num(c.min_price);
  const maxPrice = num(c.max_price);
  if (minPrice != null && price < minPrice) return false;
  if (maxPrice != null && price > maxPrice) return false;
  const area = Number(p.area_m2) || 0;
  const minArea = num(c.min_area);
  const maxArea = num(c.max_area);
  if (minArea != null && area < minArea) return false;
  if (maxArea != null && area > maxArea) return false;
  const atLeast = (want: unknown, have: unknown) => {
    const w = num(want);
    return w == null || (Number(have) || 0) >= w;
  };
  if (!atLeast(c.min_bedrooms, p.bedrooms) || !atLeast(c.min_bathrooms, p.bathrooms) || !atLeast(c.min_parking, p.parking)) return false;
  const wanted = Array.isArray(c.amenities) ? (c.amenities as string[]) : [];
  if (wanted.length > 0) {
    const have = new Set(p.amenities || []);
    if (!wanted.every((a) => have.has(a))) return false;
  }
  return true;
}

// Hora en México (0-23) y horario en que se puede avisar (8 am a 8 pm).
export function mexicoHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "America/Mexico_City" }).format(now)) % 24;
}
export const isQuietHour = (now = new Date()): boolean => {
  const h = mexicoHour(now);
  return h < 8 || h >= 20;
};

const money = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export type Notification = {
  alert: Alert;
  kind: "search" | "price";
  propertyIds: string[]; // todo lo que se marca como avisado
  prices: Record<string, number>; // precio avisado por propiedad (para 'price')
  aviso: string;
  link: string;
};

// Qué avisar ahora. Sin efectos: recibe alertas, propiedades y lo ya enviado.
export function planNotifications({
  alerts,
  properties,
  deliveries,
  siteUrl = DEFAULT_SITE_URL,
}: {
  alerts: Alert[];
  properties: Property[];
  deliveries: Delivery[];
  siteUrl?: string;
}): Notification[] {
  const byId = new Map(properties.map((p) => [p.id, p]));
  const sent = new Map<string, Delivery[]>();
  for (const d of deliveries) {
    const key = `${d.alert_id}|${d.property_id}|${d.kind}`;
    sent.set(key, [...(sent.get(key) || []), d]);
  }
  const out: Notification[] = [];

  for (const alert of alerts.filter((a) => a.active).slice(0, MAX_ALERTS_PER_RUN)) {
    if (alert.kind === "price") {
      const p = alert.property_id ? byId.get(alert.property_id) : undefined;
      if (!p || !isAvailable(p)) continue;
      const previous = (sent.get(`${alert.id}|${p.id}|price`) || []).map((d) => Number(d.price)).filter((n) => Number.isFinite(n));
      const baseline = Math.min(Number(alert.price_at_subscribe ?? Infinity), ...previous);
      const price = Number(p.price);
      if (!(price < baseline)) continue;
      out.push({
        alert,
        kind: "price",
        propertyIds: [p.id],
        prices: { [p.id]: price },
        aviso: oneLine(`la propiedad ${p.title} bajó de precio: ahora ${money(price)} (antes ${money(baseline)}).`),
        link: `${siteUrl}/propiedades/${p.id}`,
      });
      continue;
    }

    // Búsqueda guardada: propiedades disponibles publicadas DESPUÉS de suscribirse,
    // que coinciden y de las que aún no se le avisó.
    const since = Date.parse(alert.created_at);
    const matches = properties
      .filter((p) => isAvailable(p) && Date.parse(p.created_at) >= since && matchesCriteria(p, alert.criteria) && !sent.has(`${alert.id}|${p.id}|search`))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    if (matches.length === 0) continue;
    const shown = matches.slice(0, MAX_ITEMS_IN_MESSAGE).map((p) => oneLine(`${p.title}${p.zone ? ` (${p.zone})` : ""} — ${money(Number(p.price))}`));
    const extra = matches.length - shown.length;
    const list = extra > 0 ? `${shown.join(" · ")} · y ${extra} más` : shown.join(" · ");
    out.push({
      alert,
      kind: "search",
      propertyIds: matches.map((p) => p.id),
      prices: {},
      aviso: matches.length === 1 ? `hay una propiedad nueva que coincide con tu búsqueda: ${list}.` : `hay ${matches.length} propiedades nuevas que coinciden con tu búsqueda: ${list}.`,
      link: matches.length === 1 ? `${siteUrl}/propiedades/${matches[0].id}` : `${siteUrl}/propiedades`,
    });
  }
  return out;
}

export function buildPayload(n: Notification, siteUrl = DEFAULT_SITE_URL) {
  const first = n.alert.name.trim().split(/\s+/)[0] || n.alert.name;
  return {
    messaging_product: "whatsapp",
    to: n.alert.phone,
    type: "template",
    template: {
      name: "alerta_propiedad",
      language: { code: "es_MX" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", parameter_name: "nombre", text: first },
            { type: "text", parameter_name: "aviso", text: n.aviso },
            { type: "text", parameter_name: "enlace", text: n.link },
            { type: "text", parameter_name: "enlace_baja", text: `${siteUrl}/alertas/baja/${n.alert.unsubscribe_token}` },
          ],
        },
      ],
    },
  };
}

async function handler(req: Request): Promise<Response> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }
  if (isQuietHour()) {
    return new Response(JSON.stringify({ skipped: "fuera de horario (8 am a 8 pm, hora de México)" }), { headers: { "Content-Type": "application/json" } });
  }

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const whatsappToken = Deno.env.get("WHATSAPP_TOKEN")!;
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
  const siteUrl = Deno.env.get("SITE_URL") || DEFAULT_SITE_URL;

  const { data: alerts, error: alertsError } = await supabase.from("property_alerts").select("*").eq("active", true);
  if (alertsError) return new Response(JSON.stringify({ error: alertsError.message }), { status: 500 });
  if (!alerts || alerts.length === 0) return new Response(JSON.stringify({ results: {} }), { headers: { "Content-Type": "application/json" } });

  const { data: properties, error: propsError } = await supabase.from("properties").select("*").eq("active", true).eq("status", "disponible");
  if (propsError) return new Response(JSON.stringify({ error: propsError.message }), { status: 500 });

  const { data: deliveries } = await supabase.from("property_alert_deliveries").select("alert_id, property_id, kind, price");

  const plan = planNotifications({ alerts: alerts as Alert[], properties: (properties || []) as Property[], deliveries: (deliveries || []) as Delivery[], siteUrl });
  const results: Record<string, string> = {};

  for (const n of plan) {
    // Reclama: registra el aviso ANTES de enviar. Si el envío falla, se borra para
    // reintentar en la siguiente hora; si la función se cae a medio camino, el peor
    // caso es un aviso que no salió, nunca uno duplicado.
    const rows = n.propertyIds.map((property_id) => ({ alert_id: n.alert.id, property_id, kind: n.kind, price: n.prices[property_id] ?? null }));
    const { error: claimError } = await supabase.from("property_alert_deliveries").insert(rows);
    if (claimError) {
      results[n.alert.id] = `no se pudo reclamar: ${claimError.message}`;
      continue;
    }
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(n, siteUrl)),
      });
      const body = await res.json();
      if (res.ok) {
        await supabase.from("property_alerts").update({ last_notified_at: new Date().toISOString() }).eq("id", n.alert.id);
        results[n.alert.id] = "enviado";
      } else {
        await supabase.from("property_alert_deliveries").delete().eq("alert_id", n.alert.id).in("property_id", n.propertyIds).eq("kind", n.kind);
        results[n.alert.id] = `error WhatsApp: ${JSON.stringify(body)}`;
      }
    } catch (err) {
      await supabase.from("property_alert_deliveries").delete().eq("alert_id", n.alert.id).in("property_id", n.propertyIds).eq("kind", n.kind);
      results[n.alert.id] = `error de red: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return new Response(JSON.stringify({ avisos: plan.length, results }), { headers: { "Content-Type": "application/json" } });
}

// Solo dentro de Deno (en las pruebas se importan las funciones puras y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
