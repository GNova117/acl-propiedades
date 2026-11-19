// Calendario suscribible de la Agenda (/api/agenda-ics?t=<token>): lo que Google Calendar, Apple Calendar y Outlook leen
// solos cada cierto tiempo. SOLO lectura y en un sentido: el calendario externo no escribe nada en el sitio.
// El token (64 hex) es el secreto: quien tenga la URL ve las citas de esa persona hasta que la regenere.
// `rpc(name, args)` devuelve { data, error } (supabase.rpc); se inyecta para poder probar sin red.
import { citasToIcsFeed } from "../src/lib/calendarEvent.js";

export const FEED_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export async function serveAgendaFeed({ token, rpc, now = new Date() }) {
  if (!FEED_TOKEN_PATTERN.test(String(token || ""))) return { status: 404, headers: { "Cache-Control": "no-store" }, body: "Not found" };
  let result;
  try {
    result = await rpc("get_agenda_feed", { p_token: token });
  } catch {
    result = { error: true };
  }
  if (result?.error || !Array.isArray(result?.data)) return { status: 502, headers: { "Cache-Control": "no-store" }, body: "Calendar unavailable" };
  return {
    status: 200,
    // `private`: la URL lleva el secreto; que no la guarde un CDN compartido.
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300", "Content-Disposition": 'inline; filename="agenda-acl.ics"' },
    body: citasToIcsFeed(result.data, { now }),
  };
}
