// Se ejecuta cada hora (pg_cron, ver el bloque «Mis ventas y comisiones / Le encaja a tu prospecto» al final de schema.sql) y
// avisa por push a cada asesor cuando entró una propiedad nueva —o bajó de precio— que le encaja a alguno de sus prospectos
// abiertos (los criterios de «qué busca» del prospecto). Lo que no tiene asesor va a la oficina. Solo de 8 am a 8 pm hora de México.
//
// Valida con su propio x-cron-secret (se despliega con la verificación de JWT desactivada, igual que las demás funciones de cron) y
// corre con la service role key porque lee prospectos y propiedades de todos. Para mandar el push llama a `enviar-push`, que ya
// sabe llegar a los dispositivos de un asesor (`advisorId`) o de la oficina (`section` + `office`).
//
// La lógica de qué avisar vive en _shared/prospectMatchPush.js (con pruebas); este archivo solo conecta con Deno y la base.
//
// Reclama antes de enviar: la novedad se registra en property_match_pushes ANTES del push; si el push falla, se borra el registro
// para reintentar en la siguiente hora. Si la función se cae a medio camino, el peor caso es un aviso que no salió, nunca uno repetido.

import { EVENT_WINDOW_HOURS, OPEN_STAGES, eventKey, isQuietHour, planMatchPushes } from "../_shared/prospectMatchPush.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function handler(req: Request): Promise<Response> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }
  if (isQuietHour()) return json({ skipped: "fuera de horario (8 am a 8 pm, hora de México)" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(supabaseUrl, serviceKey);

  const since = new Date(Date.now() - EVENT_WINDOW_HOURS * 3600000).toISOString();

  // Novedades: propiedades disponibles dadas de alta o con cambio de precio dentro de la ventana.
  const { data: properties, error: propsError } = await supabase
    .from("properties")
    .select("*")
    .eq("active", true)
    .eq("status", "disponible")
    .or(`created_at.gte.${since},price_changed_at.gte.${since}`);
  if (propsError) return json({ error: propsError.message }, 500);
  if (!properties || properties.length === 0) return json({ avisos: 0 });

  const { data: prospects, error: prospectsError } = await supabase
    .from("prospectos")
    .select("id, name, stage, advisor_id, property_id, search_criteria")
    .in("stage", OPEN_STAGES)
    .not("search_criteria", "is", null);
  if (prospectsError) return json({ error: prospectsError.message }, 500);

  const { data: already, error: sentError } = await supabase
    .from("property_match_pushes")
    .select("property_id, kind, event_at")
    .in("property_id", properties.map((p: { id: string }) => p.id));
  if (sentError) return json({ error: sentError.message }, 500);
  const sent = new Set((already || []).map((r: { property_id: string; kind: string; event_at: string }) => eventKey(r.property_id, r.kind, r.event_at)));

  const { claims, pushes } = planMatchPushes({ properties, prospects: prospects || [], sent });
  if (claims.length === 0) return json({ avisos: 0 });

  const { error: claimError } = await supabase.from("property_match_pushes").insert(claims);
  if (claimError) return json({ error: `no se pudo reclamar: ${claimError.message}` }, 500);

  const results: Record<string, string> = {};
  let failed = false;
  for (const push of pushes) {
    const target = push.advisorId ?? "oficina";
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/enviar-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, "x-cron-secret": cronSecret },
        body: JSON.stringify(
          push.advisorId
            ? { advisorId: push.advisorId, title: push.title, body: push.body, url: push.url }
            : { section: "prospectos", office: true, title: push.title, body: push.body, url: push.url },
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`enviar-push ${res.status}: ${JSON.stringify(body)}`);
      results[target] = "enviado";
    } catch (err) {
      failed = true;
      results[target] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Si algún push falló, se libera el registro de esta corrida para reintentar en la siguiente hora (los que ya salieron podrían
  // repetirse una vez: se prefiere eso a perder un aviso).
  if (failed) {
    for (const claim of claims) {
      await supabase.from("property_match_pushes").delete().eq("property_id", claim.property_id).eq("kind", claim.kind).eq("event_at", claim.event_at);
    }
  }

  return json({ avisos: pushes.length, results });
}

// Solo dentro de Deno (en las pruebas se importan las funciones puras y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
