// Manda notificaciones push del navegador/SO al equipo del panel admin. Se
// dispara por trigger de Postgres (after insert en contact_messages, ver
// schema.sql) con el mismo x-cron-secret que ya protege las demás funciones
// llamadas por evento/cron — no es para el público, nunca se llama desde el
// navegador directo.
//
// `section` (opcional en el body): si viene, solo se manda a quien tenga
// ese apartado (admin_access/admin_roles) — mismo criterio que
// has_admin_section() en SQL, repetido aquí en JS porque esta función usa
// la service role key y no una sesión con auth.email(). Sin `section`, se
// manda a todos los dispositivos registrados.
//
// Si un endpoint ya no es válido (404/410 — el navegador se desinstaló, se
// borraron los datos del sitio, etc.) se borra esa suscripción para no
// reintentar en vano en el siguiente aviso.

import webpush from "npm:web-push@3";

type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response(JSON.stringify({ error: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no configurados" }), { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = await req.json().catch(() => ({}));
  const title = String(payload.title || "ACL Propiedades");
  const body = String(payload.body || "");
  const url = String(payload.url || "/admin");
  const section = payload.section ? String(payload.section) : null;

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let emails: string[] | null = null;
  if (section) {
    const { data: roles, error: rolesError } = await supabase.from("admin_roles").select("id").contains("sections", [section]);
    if (rolesError) return new Response(JSON.stringify({ error: rolesError.message }), { status: 500 });
    const roleIds = (roles || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) return new Response(JSON.stringify({ sent: 0, note: "ningún rol tiene ese apartado" }), { headers: { "Content-Type": "application/json" } });

    const { data: access, error: accessError } = await supabase.from("admin_access").select("email").in("role_id", roleIds);
    if (accessError) return new Response(JSON.stringify({ error: accessError.message }), { status: 500 });
    emails = [...new Set((access || []).map((a: { email: string }) => a.email))];
    if (emails.length === 0) return new Response(JSON.stringify({ sent: 0, note: "nadie tiene ese apartado" }), { headers: { "Content-Type": "application/json" } });
  }

  let query = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (emails) query = query.in("email", emails);
  const { data: subs, error: subsError } = await query;
  if (subsError) return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });
  if (!subs || subs.length === 0) return new Response(JSON.stringify({ sent: 0, total: 0 }), { headers: { "Content-Type": "application/json" } });

  const payloadJson = JSON.stringify({ title, body, url });
  let sent = 0;
  const errors: Record<string, string> = {};

  for (const sub of subs as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payloadJson);
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
      errors[sub.endpoint] = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(JSON.stringify({ sent, total: subs.length, errors }), { headers: { "Content-Type": "application/json" } });
});
