// Se ejecuta una vez a la semana (vía pg_cron, ver el bloque "Resumen semanal
// por correo" en schema.sql: lunes 8:00 am hora de México) y manda a los socios
// un correo con lo que pasó los últimos 7 días contra los 7 anteriores.
// Igual que seguimientos-resumen-diario: valida con su propio x-cron-secret
// (se despliega con la verificación de JWT desactivada) y lee con la service
// role key inyectada por Supabase, porque junta datos de todos los asesores.
// La lógica (fechas, métricas, correo) está en report.js, que sí tiene pruebas.
//
// Cuerpo opcional (JSON): { "dryRun": true } devuelve el reporte y el correo
// sin enviar nada ni marcar la semana como enviada; { "to": "a@x.com" } manda
// solo a esa dirección (prueba) y tampoco marca la semana.

import { buildWeeklyReport, renderWeeklyEmail, resolveRecipients, TIMEZONE, weekWindows } from "./report.js";

const DEFAULT_SITE_URL = "https://acl-propiedades.vercel.app";
const PAGE = 5000;

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

  const today = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const { current, previous } = weekWindows(today);
  const since = previous.start; // todo lo que se necesita empieza con la semana anterior
  const sinceIso = `${since}T00:00:00-06:00`; // México sin horario de verano (UTC-6 fijo), igual que el cron

  // Ya se mandó esta semana (protege contra un redisparo manual del cron).
  if (!options.dryRun && !options.to) {
    const { data: already } = await supabase.from("reporte_semanal_enviados").select("semana_inicio").eq("semana_inicio", current.start).maybeSingle();
    if (already) return Response.json({ week: current, skipped: "ya enviado esta semana" });
  }

  const [ventas, properties, visits, prospects, messages, views, access] = await Promise.all([
    supabase.from("ventas").select("property_id, fecha_venta").gte("fecha_venta", since),
    supabase.from("properties").select("id, title, code, price, status, active, created_at").limit(PAGE),
    supabase.from("property_visits").select("visited_at, interest").gte("visited_at", sinceIso),
    supabase.from("prospectos").select("source, stage, created_at, last_contact_at, next_followup_at").order("created_at", { ascending: false }).limit(PAGE),
    supabase.from("contact_messages").select("created_at").gte("created_at", sinceIso),
    supabase.from("property_views").select("property_id, viewed_on").gte("viewed_on", since).limit(PAGE),
    supabase.from("admin_access").select("email, admin_roles(sections)"),
  ]);

  const failed = [ventas, properties, visits, prospects, messages, views, access].find((r) => r.error);
  if (failed?.error) return Response.json({ error: failed.error.message }, { status: 500 });

  const report = buildWeeklyReport(
    { ventas: ventas.data, properties: properties.data, visits: visits.data, prospects: prospects.data, messages: messages.data, views: views.data },
    today,
  );
  const email = renderWeeklyEmail(report, { siteUrl: Deno.env.get("SITE_URL") || DEFAULT_SITE_URL });

  if (options.dryRun) return Response.json({ week: current, report, subject: email.subject, html: email.html });

  const recipients = options.to ? [String(options.to)] : resolveRecipients(access.data, Deno.env.get("WEEKLY_REPORT_TO"));
  if (recipients.length === 0) return Response.json({ week: current, error: "sin destinatarios (nadie tiene el apartado reportes)" }, { status: 400 });

  const results: Record<string, string> = {};
  for (const to of recipients) {
    try {
      await sendEmail(to, email.subject, email.html, email.text);
      results[to] = "enviado";
    } catch (err) {
      results[to] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Se marca la semana solo si llegó al menos uno (un error de Resend no
  // bloquea el reintento) y no fue una prueba con "to".
  if (!options.to && Object.values(results).some((r) => r === "enviado")) {
    await supabase.from("reporte_semanal_enviados").insert({ semana_inicio: current.start, destinatarios: recipients.length });
  }

  return Response.json({ week: current, results });
}

// Solo dentro de Deno (en las pruebas se importa report.js y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
