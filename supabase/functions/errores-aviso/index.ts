// Se ejecuta cada 30 minutos (vía pg_cron, ver el bloque «Monitoreo de errores del navegador» en schema.sql) y manda a los
// administradores UN correo con los errores del navegador que aún no se han avisado (status «nuevo» y notified_at nulo).
// Igual que reporte-semanal: valida con su propio x-cron-secret (se despliega con la verificación de JWT desactivada) y lee
// con la service role key inyectada por Supabase. La lógica del correo está en digest.js, que sí tiene pruebas.
//
// Cuerpo opcional (JSON): { "dryRun": true } devuelve el correo sin enviar ni marcar nada.

import { adminRecipients, buildErrorDigest } from "./digest.js";

const DEFAULT_SITE_URL = "https://acl-propiedades.vercel.app";

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY")!;
  const from = Deno.env.get("RESEND_FROM") || "ACL Propiedades <avisos@aclpropiedades.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend: ${JSON.stringify(body)}`);
  return body;
}

async function handler(req: Request): Promise<Response> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const options = await req.json().catch(() => ({}));
  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: errors, error } = await supabase
    .from("client_errors")
    .select("id, message, url, count, release, last_seen, source, reported_by")
    .eq("status", "nuevo")
    .is("notified_at", null)
    .order("last_seen", { ascending: false })
    .limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const email = buildErrorDigest(errors, { siteUrl: Deno.env.get("SITE_URL") || DEFAULT_SITE_URL });
  if (!email) return Response.json({ skipped: "sin errores nuevos" });
  if (options.dryRun) return Response.json({ subject: email.subject, html: email.html, count: errors!.length });

  const { data: access, error: accessError } = await supabase.from("admin_access").select("email, admin_roles(sections)");
  if (accessError) return Response.json({ error: accessError.message }, { status: 500 });
  const recipients = adminRecipients(access, Deno.env.get("ERRORS_REPORT_TO"));
  if (recipients.length === 0) return Response.json({ error: "sin destinatarios (nadie tiene el apartado roles)" }, { status: 400 });

  const results: Record<string, string> = {};
  for (const to of recipients) {
    try {
      await sendEmail(to, email.subject, email.html, email.text);
      results[to] = "enviado";
    } catch (err) {
      results[to] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Se marcan como avisados solo si llegó a alguien (un fallo de Resend no pierde el aviso: se reintenta a la siguiente).
  if (Object.values(results).some((r) => r === "enviado")) {
    await supabase.from("client_errors").update({ notified_at: new Date().toISOString() }).in("id", errors!.map((e: { id: string }) => e.id));
  }

  return Response.json({ count: errors!.length, results });
}

// Solo dentro de Deno (en las pruebas se importa digest.js y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
