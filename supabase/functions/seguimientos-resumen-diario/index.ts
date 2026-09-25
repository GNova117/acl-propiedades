// Se ejecuta una vez al día (vía pg_cron, ver el bloque "Aviso diario de
// seguimientos por WhatsApp" en schema.sql) y le manda a cada asesor con
// seguimientos de prospectos vencidos o para hoy un resumen por WhatsApp, con
// la plantilla "resumen_seguimientos_dia" (hay que crearla y aprobarla en Meta
// Business Manager; el texto sugerido está en el README de esta función en
// schema.sql). Igual que agenda-resumen-diario: no usa RLS (corre con la service
// role key inyectada por Supabase) porque lee los prospectos de TODOS los asesores.
//
// La lógica de armar el resumen está en funciones puras y exportadas para
// poder probarlas fuera de Deno; el servidor solo arranca dentro de Deno.

const GRAPH_VERSION = "v25.0";
const OPEN_STAGES = ["nuevo", "contactado", "interesado", "negociacion"];
const MAX_NAMES = 8;

export type FollowUpRow = {
  id: string;
  name: string;
  next_followup_at: string; // YYYY-MM-DD
  advisor_id: string;
  advisors?: { name: string; whatsapp: string | null } | { name: string; whatsapp: string | null }[] | null;
};

export type AdvisorDigest = {
  advisorId: string;
  name: string;
  whatsapp: string;
  items: { name: string; daysLate: number }[];
};

export function todayInMexico(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

// Un resumen por asesor (solo los que tienen WhatsApp), con los más atrasados primero.
export function groupFollowUps(rows: FollowUpRow[], today: string): AdvisorDigest[] {
  const byAdvisor = new Map<string, AdvisorDigest>();
  for (const row of rows) {
    const advisor = Array.isArray(row.advisors) ? row.advisors[0] : row.advisors;
    if (!advisor?.whatsapp || !row.advisor_id) continue;
    if (row.next_followup_at > today) continue;
    const entry = byAdvisor.get(row.advisor_id) || { advisorId: row.advisor_id, name: advisor.name, whatsapp: advisor.whatsapp, items: [] };
    entry.items.push({ name: row.name, daysLate: Math.max(0, daysBetween(row.next_followup_at, today)) });
    byAdvisor.set(row.advisor_id, entry);
  }
  for (const entry of byAdvisor.values()) entry.items.sort((a, b) => b.daysLate - a.daysLate || a.name.localeCompare(b.name));
  return Array.from(byAdvisor.values());
}

// Los parámetros de una plantilla de WhatsApp no aceptan saltos de línea, por eso
// se separa con " · ". "hoy" o "hace N d" indica el atraso.
export function formatList(items: { name: string; daysLate: number }[], max = MAX_NAMES): string {
  const shown = items.slice(0, max).map((i) => `${i.name} (${i.daysLate === 0 ? "hoy" : `hace ${i.daysLate} d`})`);
  const extra = items.length - shown.length;
  return extra > 0 ? `${shown.join(" · ")} · y ${extra} más` : shown.join(" · ");
}

export function buildPayload(digest: AdvisorDigest) {
  return {
    messaging_product: "whatsapp",
    to: digest.whatsapp,
    type: "template",
    template: {
      name: "resumen_seguimientos_dia",
      language: { code: "es_MX" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", parameter_name: "nombre_asesor", text: digest.name },
            { type: "text", parameter_name: "num_seguimientos", text: String(digest.items.length) },
            { type: "text", parameter_name: "lista_seguimientos", text: formatList(digest.items) },
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

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const whatsappToken = Deno.env.get("WHATSAPP_TOKEN")!;
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

  const fecha = todayInMexico();

  const { data: rows, error } = await supabase
    .from("prospectos")
    .select("id, name, next_followup_at, advisor_id, advisors(name, whatsapp)")
    .in("stage", OPEN_STAGES)
    .not("advisor_id", "is", null)
    .not("next_followup_at", "is", null)
    .lte("next_followup_at", fecha);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: Record<string, string> = {};

  for (const digest of groupFollowUps((rows || []) as FollowUpRow[], fecha)) {
    // Dedup: si ya se mandó el resumen de hoy a este asesor no se repite (protege
    // contra un redisparo manual del cron). Se revisa ANTES de enviar y se marca
    // como enviado solo DESPUÉS de un envío exitoso: un error real de la API no
    // bloquea el reintento hasta mañana.
    const { data: alreadySent } = await supabase
      .from("seguimientos_resumenes_enviados")
      .select("advisor_id")
      .eq("advisor_id", digest.advisorId)
      .eq("fecha", fecha)
      .maybeSingle();
    if (alreadySent) {
      results[digest.advisorId] = "ya enviado hoy, se omite";
      continue;
    }

    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(digest)),
      });
      const body = await res.json();
      if (res.ok) {
        await supabase.from("seguimientos_resumenes_enviados").insert({ advisor_id: digest.advisorId, fecha });
        results[digest.advisorId] = "enviado";
      } else {
        results[digest.advisorId] = `error WhatsApp: ${JSON.stringify(body)}`;
      }
    } catch (err) {
      results[digest.advisorId] = `error de red: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return new Response(JSON.stringify({ fecha, results }), { headers: { "Content-Type": "application/json" } });
}

// Solo dentro de Deno (en las pruebas se importan las funciones puras y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
