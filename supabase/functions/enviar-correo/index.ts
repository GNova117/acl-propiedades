// Envío puntual de UN correo por una acción del staff — no por pg_cron. Lo usan
// el botón "Enviar por correo" de Visitas (informe al vendedor) y de Gastos
// (desglose en PDF), y la rama de correo de las alertas de propiedades
// también manda directo por Resend (no por aquí, para no depender de esta
// función en su corrida de cada hora).
//
// A diferencia de agenda-recordatorio-30min/alertas-propiedades (que corren
// por pg_cron, desactivan la verificación de JWT de Supabase y validan con su
// propio x-cron-secret), esta función SÍ se deja con "Enforce JWT
// Verification" activado (el valor por omisión al crearla): el navegador la
// llama directo con la sesión de Supabase Auth del staff vía
// supabase.functions.invoke(), y el gateway de Supabase ya rechaza la
// llamada antes de que este código corra si no hay una sesión válida.

const RESEND_URL = "https://api.resend.com/emails";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado" }), { status: 500 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const html = String(payload.html || "");
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: "Faltan to/subject/html" }), { status: 400 });
  }

  const from = Deno.env.get("RESEND_FROM") || "ACL Propiedades <avisos@aclpropiedades.com>";
  const body: Record<string, unknown> = { from, to, subject, html };

  const attachment = payload.attachment;
  if (attachment?.filename && attachment?.contentBase64) {
    body.attachments = [{ filename: String(attachment.filename), content: String(attachment.contentBase64) }];
  }

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return new Response(JSON.stringify({ error: result }), { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true, id: result?.id }), { headers: { "Content-Type": "application/json" } });
});
