// Se ejecuta una vez al día (vía pg_cron, ver el bloque "Recordatorio de cita al
// cliente por WhatsApp" en schema.sql, 6:00 pm hora de México) y le manda a cada
// cliente que tiene una cita MAÑANA un recordatorio por WhatsApp con la
// plantilla "recordatorio_cita_cliente" (hay que crearla y aprobarla en Meta
// Business Manager; el texto sugerido está en schema.sql). A diferencia de
// agenda-recordatorio-30min (que avisa al asesor), este va al cliente.
//
// Igual que las otras funciones de Agenda, "reclama" la cita (marca
// client_reminder_sent_at) ANTES de mandar el mensaje: si algo falla a medio
// envío, el peor caso es un recordatorio que no salió, nunca uno duplicado.
// Corre con la service role key porque lee las citas de TODOS los asesores.
//
// La lógica de armar el mensaje está en funciones puras y exportadas para poder
// probarlas fuera de Deno; el servidor solo arranca dentro de Deno.

const GRAPH_VERSION = "v25.0";

type Named = { name: string; phone?: string | null } | null;

export type CitaRow = {
  id: string;
  titulo: string;
  fecha: string; // YYYY-MM-DD
  hora: string | null; // HH:MM:SS
  clients?: Named | Named[];
  advisors?: { name: string } | { name: string }[] | null;
};

export function tomorrowInMexico(now = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Teléfono a formato de WhatsApp Cloud API (52 + 10 dígitos). null si no se puede.
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length === 13 && digits.startsWith("521")) return `52${digits.slice(3)}`;
  return null;
}

// "mañana sábado 26 de septiembre a las 11:00" (o sin hora si la cita no la tiene).
export function formatWhen(fecha: string, hora: string | null): string {
  const day = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return hora ? `mañana ${day} a las ${hora.slice(0, 5)}` : `mañana ${day}`;
}

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

// Un envío por cita con cliente con teléfono válido.
export function buildReminders(citas: CitaRow[]) {
  const reminders: { citaId: string; to: string; params: { nombre_cliente: string; titulo_cita: string; fecha_hora: string; nombre_asesor: string } }[] = [];
  const skipped: Record<string, string> = {};
  for (const cita of citas) {
    const client = one(cita.clients);
    if (!client) {
      skipped[cita.id] = "sin cliente asignado";
      continue;
    }
    const to = normalizePhone(client.phone);
    if (!to) {
      skipped[cita.id] = "cliente sin teléfono válido";
      continue;
    }
    reminders.push({
      citaId: cita.id,
      to,
      params: {
        nombre_cliente: client.name.trim().split(/\s+/)[0] || client.name,
        titulo_cita: cita.titulo,
        fecha_hora: formatWhen(cita.fecha, cita.hora),
        nombre_asesor: one(cita.advisors)?.name || "tu asesor de ACL Propiedades",
      },
    });
  }
  return { reminders, skipped };
}

export function buildPayload(reminder: ReturnType<typeof buildReminders>["reminders"][number]) {
  return {
    messaging_product: "whatsapp",
    to: reminder.to,
    type: "template",
    template: {
      name: "recordatorio_cita_cliente",
      language: { code: "es_MX" },
      components: [
        {
          type: "body",
          parameters: Object.entries(reminder.params).map(([parameter_name, text]) => ({ type: "text", parameter_name, text })),
        },
      ],
    },
  };
}

async function handler(req: Request): Promise<Response> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const whatsappToken = Deno.env.get("WHATSAPP_TOKEN")!;
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

  const fecha = tomorrowInMexico();

  const { data: citas, error } = await supabase
    .from("agenda_citas")
    .select("id, titulo, fecha, hora, clients(name, phone), advisors(name)")
    .eq("fecha", fecha)
    .is("client_reminder_sent_at", null)
    .not("client_id", "is", null)
    .not("status", "in", "(cancelada,realizada)");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const { reminders, skipped } = buildReminders((citas || []) as CitaRow[]);
  const results: Record<string, string> = { ...skipped };

  for (const reminder of reminders) {
    // Reclama la cita antes de enviar: si otra corrida ya la marcó, se omite.
    const { data: claimed } = await supabase
      .from("agenda_citas")
      .update({ client_reminder_sent_at: new Date().toISOString() })
      .eq("id", reminder.citaId)
      .is("client_reminder_sent_at", null)
      .select()
      .maybeSingle();
    if (!claimed) {
      results[reminder.citaId] = "ya reclamada por otra corrida, se omite";
      continue;
    }

    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(reminder)),
      });
      const body = await res.json();
      results[reminder.citaId] = res.ok ? "enviado" : `error WhatsApp: ${JSON.stringify(body)}`;
    } catch (err) {
      results[reminder.citaId] = `error de red: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return new Response(JSON.stringify({ fecha, results }), { headers: { "Content-Type": "application/json" } });
}

// Solo dentro de Deno (en las pruebas se importan las funciones puras y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
