// Calendario suscribible de la Agenda (ver server/agendaFeed.js). Usa la llave pública: la función
// get_agenda_feed de la base ya valida el token y no devuelve teléfonos ni correos de clientes.
import { createClient } from "@supabase/supabase-js";
import { serveAgendaFeed } from "./agendaFeed.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).send("Method not allowed");
    return;
  }
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(503).send("Not configured");
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const out = await serveAgendaFeed({ token: req.query?.t, rpc: (name, args) => supabase.rpc(name, args) });
  for (const [name, value] of Object.entries(out.headers)) res.setHeader(name, value);
  res.status(out.status).send(out.body);
}
