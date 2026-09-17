// Se dispara desde un trigger de Postgres (after insert en contact_messages),
// no desde pg_cron como las de Agenda — cada mensaje nuevo del formulario
// público llega una sola vez, así que no hace falta ventana de tiempo ni
// "reclamo"/dedup: el trigger ya garantiza que esto corre exactamente una
// vez por mensaje. El trigger manda los datos del mensaje directo en el
// body (ya los tiene en `new`), así que esta función no vuelve a consultar
// Supabase.
const GRAPH_VERSION = "v25.0";
const MESSAGE_PREVIEW_LENGTH = 300;

// Los teléfonos de los asesores se capturan como los escribe una persona
// ("871 324 3271", "(871) 324-3271", a veces ya con lada de país). La
// Cloud API los quiere en dígitos con lada de país, así que aquí se
// normalizan: 10 dígitos → se les antepone 52 (México); 11 dígitos que
// empiezan con 1 → es el viejo formato de celular (1 + 10), se quita ese 1
// y se antepone 52; cualquier otro largo se manda tal cual en dígitos
// (ya trae lada de país o es un número que no podemos adivinar).
function toWhatsAppNumber(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `52${digits.slice(1)}`;
  if (digits.length >= 12) return digits;
  return null;
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const whatsappToken = Deno.env.get("WHATSAPP_TOKEN")!;
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

  const payload = await req.json().catch(() => ({}));
  const name = payload.name || "(sin nombre)";
  const phone = payload.phone || "(sin teléfono)";
  const message = String(payload.message || "").slice(0, MESSAGE_PREVIEW_LENGTH);

  // El trigger manda los teléfonos de los asesores de la propiedad por la
  // que preguntaron (vacío si el mensaje viene del formulario de Contacto,
  // que no trae propiedad). Van primero, pero la oficina sigue recibiendo
  // copia de todo: si el asesor no contesta, el mensaje no se pierde.
  const advisorNumbers = (Array.isArray(payload.advisorPhones) ? payload.advisorPhones : [])
    .map(toWhatsAppNumber)
    .filter((n): n is string => Boolean(n));

  const officeNumbers = (Deno.env.get("CONTACT_NOTIFY_WHATSAPP") || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  // Set: si un asesor es también un número de oficina, recibe un solo aviso.
  const recipients = [...new Set([...advisorNumbers, ...officeNumbers])];

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ error: "Sin destinatarios: CONTACT_NOTIFY_WHATSAPP no configurado y la propiedad no tiene asesor con teléfono" }), { status: 500 });
  }

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
