// Se ejecuta una vez al día (vía pg_cron, ver el bloque "Avisos de agenda
// por WhatsApp" en schema.sql) y le manda a cada asesor con citas hoy un
// resumen por WhatsApp usando la plantilla "resumen_citas_dia" (aprobada
// en Meta Business Manager). No usa RLS — corre con la service role key
// (inyectada automáticamente por Supabase en toda Edge Function) porque
// necesita leer las citas de TODOS los asesores, no solo las de un login.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GRAPH_VERSION = "v25.0";

function todayInMexico(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const whatsappToken = Deno.env.get("WHATSAPP_TOKEN")!;
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

  const fecha = todayInMexico();

  const { data: citas, error } = await supabase
    .from("agenda_citas")
    .select("id, titulo, hora, advisor_id, advisors(name, whatsapp), clients(name)")
    .eq("fecha", fecha)
    .order("hora", { ascending: true, nullsFirst: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const byAdvisor = new Map<string, { name: string; whatsapp: string | null; citas: typeof citas }>();
  for (const cita of citas || []) {
    const advisor = Array.isArray(cita.advisors) ? cita.advisors[0] : cita.advisors;
    if (!advisor?.whatsapp) continue;
    const entry = byAdvisor.get(cita.advisor_id) || { name: advisor.name, whatsapp: advisor.whatsapp, citas: [] };
    entry.citas.push(cita);
    byAdvisor.set(cita.advisor_id, entry);
  }

  const results: Record<string, string> = {};

  for (const [advisorId, { name, whatsapp, citas: advisorCitas }] of byAdvisor) {
    // Dedup: si ya se mandó el resumen de hoy a este asesor, no se repite
    // (protege contra un redisparo manual del cron durante pruebas). Se
    // revisa ANTES de enviar pero se marca como enviado solo DESPUÉS de un
    // envío exitoso — así un error real de la API (credenciales, WhatsApp
    // caído, etc.) no bloquea el reintento hasta el día siguiente.
    const { data: alreadySent } = await supabase
      .from("agenda_resumenes_enviados")
      .select("advisor_id")
      .eq("advisor_id", advisorId)
      .eq("fecha", fecha)
      .maybeSingle();
    if (alreadySent) {
      results[advisorId] = "ya enviado hoy, se omite";
      continue;
    }

    const lista = advisorCitas
      .map((c) => {
        const cliente = Array.isArray(c.clients) ? c.clients[0] : c.clients;
        const hora = c.hora ? c.hora.slice(0, 5) : "--:--";
        return `${hora} — ${c.titulo}${cliente ? ` — ${cliente.name}` : ""}`;
      })
      .join("\n");

    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: whatsapp,
          type: "template",
          template: {
            name: "resumen_citas_dia",
            language: { code: "es_MX" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "nombre_asesor", text: name },
                  { type: "text", parameter_name: "num_citas", text: String(advisorCitas.length) },
                  { type: "text", parameter_name: "lista_citas", text: lista },
                ],
              },
            ],
          },
        }),
      });
      const body = await res.json();
      if (res.ok) {
        await supabase.from("agenda_resumenes_enviados").insert({ advisor_id: advisorId, fecha });
        results[advisorId] = "enviado";
      } else {
        results[advisorId] = `error WhatsApp: ${JSON.stringify(body)}`;
      }
    } catch (err) {
      results[advisorId] = `error de red: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return new Response(JSON.stringify({ fecha, results }), { headers: { "Content-Type": "application/json" } });
});
