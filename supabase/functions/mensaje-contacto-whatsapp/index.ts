// Se dispara desde un trigger de Postgres (after insert en contact_messages),
// no desde pg_cron como las de Agenda — cada mensaje nuevo del formulario
// público llega una sola vez, así que no hace falta ventana de tiempo ni
// "reclamo"/dedup: el trigger ya garantiza que esto corre exactamente una
// vez por mensaje. El trigger manda los datos del mensaje directo en el
// body (ya los tiene en `new`), así que esta función no vuelve a consultar
// Supabase.
const GRAPH_VERSION = "v25.0";
const MESSAGE_PREVIEW_LENGTH = 300;

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const whatsappToken = Deno.env.get("WHATSAPP_TOKEN")!;
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
  const recipients = (Deno.env.get("CONTACT_NOTIFY_WHATSAPP") || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ error: "CONTACT_NOTIFY_WHATSAPP no configurado" }), { status: 500 });
  }

  const payload = await req.json().catch(() => ({}));
  const name = payload.name || "(sin nombre)";
  const phone = payload.phone || "(sin teléfono)";
  const message = String(payload.message || "").slice(0, MESSAGE_PREVIEW_LENGTH);

  const results: Record<string, string> = {};

  for (const to of recipients) {
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: "nuevo_mensaje_contacto",
            language: { code: "es_MX" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "nombre", text: name },
                  { type: "text", parameter_name: "telefono", text: phone },
                  { type: "text", parameter_name: "mensaje", text: message },
                ],
              },
            ],
          },
        }),
      });
      const body = await res.json();
      results[to] = res.ok ? "enviado" : `error WhatsApp: ${JSON.stringify(body)}`;
    } catch (err) {
      results[to] = `error de red: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
