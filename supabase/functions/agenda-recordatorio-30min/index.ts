// Corre cada 5 minutos (vía pg_cron) y le avisa por WhatsApp a un asesor
// cuando una de sus citas está a ~30 minutos de empezar, usando la
// plantilla "recordatorio_cita". Ventana de ±5 min alrededor del blanco de
// 30 min para no perder citas entre corridas del cron. "Reclama" la cita
// (marca reminder_sent_at) ANTES de mandar el mensaje, no después: si la
// función falla a medio envío, el peor caso es un recordatorio que no
// salió (se puede reintentar a mano), nunca uno duplicado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GRAPH_VERSION = "v25.0";
const WINDOW_MINUTES = 5;
const TARGET_MINUTES_AHEAD = 30;

function nowInMexico(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
}

function toHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

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

  const now = nowInMexico();
  const target = new Date(now.getTime() + TARGET_MINUTES_AHEAD * 60_000);
  const windowStart = toHm(new Date(target.getTime() - WINDOW_MINUTES * 60_000));
  const windowEnd = toHm(new Date(target.getTime() + WINDOW_MINUTES * 60_000));
  const fecha = todayInMexico();

  const { data: citas, error } = await supabase
    .from("agenda_citas")
    .select("id, titulo, hora, advisors(name, whatsapp), clients(name)")
    .eq("fecha", fecha)
    .is("reminder_sent_at", null)
    .not("hora", "is", null)
    .gte("hora", windowStart)
    .lte("hora", windowEnd);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: Record<string, string> = {};

  for (const cita of citas || []) {
    const advisor = Array.isArray(cita.advisors) ? cita.advisors[0] : cita.advisors;
    if (!advisor?.whatsapp) {
      results[cita.id] = "asesor sin WhatsApp registrado, se omite";
      continue;
    }

    // Reclama la cita antes de enviar: si otra corrida ya la marcó, se omite.
    const { data: claimed } = await supabase
      .from("agenda_citas")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", cita.id)
      .is("reminder_sent_at", null)
      .select()
      .maybeSingle();
    if (!claimed) {
      results[cita.id] = "ya reclamada por otra corrida, se omite";
      continue;
    }

    const cliente = Array.isArray(cita.clients) ? cita.clients[0] : cita.clients;
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: advisor.whatsapp,
          type: "template",
          template: {
            name: "recordatorio_cita",
            language: { code: "es_MX" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: cita.titulo },
                  { type: "text", text: cita.hora?.slice(0, 5) || "" },
                  { type: "text", text: cliente?.name || "sin cliente asignado" },
                ],
              },
            ],
          },
        }),
      });
      const body = await res.json();
      results[cita.id] = res.ok ? "enviado" : `error WhatsApp: ${JSON.stringify(body)}`;
    } catch (err) {
      results[cita.id] = `error de red: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return new Response(JSON.stringify({ fecha, windowStart, windowEnd, results }), { headers: { "Content-Type": "application/json" } });
});
