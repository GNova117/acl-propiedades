// Correos de "Agendar visita con horarios reales" (fase 5) — funciones puras, sin
// Deno ni Supabase, para poder probarlas con vitest (igual que reporte-semanal/report.js).
// Las usan visita-correo (confirmación y cambios, disparada por un trigger de
// agenda_citas) y visita-recordatorios (recordatorios ~24 h y ~2 h antes, por pg_cron).
//
// Todo en hora de México (America/Mexico_City): fecha "YYYY-MM-DD" y hora "HH:MM[:SS]"
// son la hora de pared del consultorio; el servidor corre en UTC.
//
// `cita` es la fila de agenda_citas con su propiedad y asesor:
//   { id, fecha, hora, duracion_min, booking_token, contact_name, contact_email,
//     reschedule_count, cancelled_by, client_confirmed_at,
//     property: { id, title, code, address }, advisor: { name } }

export const TIMEZONE = "America/Mexico_City";
export const DEFAULT_SITE_URL = "https://acl-propiedades.vercel.app";

// Ventanas de los recordatorios, en minutos que faltan para la visita. pg_cron corre cada
// 15 min, así que cada ventana mide más que eso: toda visita cae en al menos una corrida
// (y el "reclamo" de la cita evita mandarlo dos veces).
export const REMINDER_24H = { min: 1350, max: 1440 }; // entre ~22.5 h y 24 h antes
export const REMINDER_2H = { min: 90, max: 120 }; // entre 1.5 h y 2 h antes
// No se manda recordatorio de una visita agendada o movida hace menos de esto: ya acaba de
// recibir el correo de confirmación.
export const RECENTLY_CHANGED_MINUTES = 180;

export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const firstName = (name) => String(name ?? "").trim().split(/\s+/)[0] || "";

const toMinutes = (hora) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(hora ?? ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};

// Fecha y hora de pared en México para un instante dado.
export function mexicoNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const wallMinutes = (date, minutes) => Math.round(new Date(`${date}T00:00:00Z`).getTime() / 60000) + minutes;

// Minutos que faltan para la visita (negativo si ya empezó).
export function minutesUntilVisit(fecha, hora, now = new Date()) {
  const nowMx = mexicoNow(now);
  return wallMinutes(fecha, toMinutes(hora)) - wallMinutes(nowMx.date, nowMx.minutes);
}

// Qué recordatorio toca (o null) según los minutos que faltan.
export function reminderKindFor(minutes) {
  if (minutes > REMINDER_24H.min && minutes <= REMINDER_24H.max) return "recordatorio24h";
  if (minutes > REMINDER_2H.min && minutes <= REMINDER_2H.max) return "recordatorio2h";
  return null;
}

export function recentlyChanged(updatedAt, now = new Date(), minutes = RECENTLY_CHANGED_MINUTES) {
  const at = new Date(updatedAt).getTime();
  return Number.isFinite(at) && now.getTime() - at < minutes * 60000;
}

export function formatVisitDay(fecha) {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatVisitTime(hora) {
  const minutes = toMinutes(hora);
  if (!Number.isFinite(minutes)) return "";
  return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export const visitLabel = (property) => {
  const title = String(property?.title ?? "").trim();
  return property?.code ? `${title} (${property.code})` : title;
};

export const manageUrl = (siteUrl, token) => `${siteUrl}/visita/${token}`;
export const propertyUrl = (siteUrl, property) => (property?.id ? `${siteUrl}/propiedades/${property.id}` : siteUrl);
export const mapsUrl = (address) => (String(address ?? "").trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address).trim())}` : null);

// ── Calendario (.ics) ──

const pad2 = (n) => String(n).padStart(2, "0");
const icsEscape = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
const icsFold = (line) => {
  const parts = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
};
const icsStamp = (date) =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
// Hora "flotante" (sin zona): el calendario la toma en la hora local de quien la abre, que es la de la visita.
const icsLocal = (fecha, minutes) => `${fecha.replace(/-/g, "")}T${pad2(Math.floor(minutes / 60) % 24)}${pad2(minutes % 60)}00`;

// Evento de la visita. El UID es el mismo que el del botón "Agregar a mi calendario" de la página
// (`<token>@aclpropiedades`), y SEQUENCE sube con cada cambio de horario: al abrir el archivo de
// un cambio, el calendario actualiza el evento en vez de duplicarlo.
export function buildVisitIcs(cita, { siteUrl = DEFAULT_SITE_URL, now = new Date() } = {}) {
  const start = toMinutes(cita.hora);
  const duration = Number(cita.duracion_min) > 0 ? Number(cita.duracion_min) : 60;
  const description = [
    cita.advisor?.name ? `Te atiende: ${cita.advisor.name}` : null,
    mapsUrl(cita.property?.address) ? `Cómo llegar: ${mapsUrl(cita.property.address)}` : null,
    `Ver, cambiar o cancelar tu visita: ${manageUrl(siteUrl, cita.booking_token)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ACL Propiedades//Visitas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${cita.booking_token}@aclpropiedades`,
    `SEQUENCE:${Number(cita.reschedule_count) || 0}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsLocal(cita.fecha, start)}`,
    `DTEND:${icsLocal(cita.fecha, start + duration)}`,
    `SUMMARY:${icsEscape(`Visita: ${visitLabel(cita.property)}`)}`,
  ];
  if (cita.property?.address) lines.push(`LOCATION:${icsEscape(cita.property.address)}`);
  lines.push(`DESCRIPTION:${icsEscape(description)}`);
  for (const minutes of [60, 15]) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(`Visita: ${visitLabel(cita.property)}`)}`, `TRIGGER:-PT${minutes}M`, "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(icsFold).join("\r\n")}\r\n`;
}

// UTF-8 → base64 (Resend recibe los adjuntos así). Sin Buffer: corre igual en Deno y en Node.
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// ── Correos ──

const BRAND = "#1565c0";

function renderHtml({ preheader, heading, greeting, lines, details, buttons, footnote }) {
  const detailRows = details
    .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#5a6472;font-size:14px;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;color:#12161c;font-size:15px;font-weight:600">${value}</td></tr>`)
    .join("");
  const buttonHtml = buttons
    .map(
      (b) =>
        `<a href="${esc(b.href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;${b.primary ? `background:${BRAND};color:#ffffff;border:1px solid ${BRAND}` : `background:#ffffff;color:${BRAND};border:1px solid ${BRAND}`}">${esc(b.label)}</a>`
    )
    .join("");
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e6ec">
<tr><td style="padding:20px 28px;border-bottom:3px solid ${BRAND};font-size:18px;font-weight:700;color:${BRAND}">ACL Propiedades</td></tr>
<tr><td style="padding:24px 28px 8px">
<h1 style="margin:0 0 12px;font-size:21px;color:#12161c">${esc(heading)}</h1>
<p style="margin:0 0 14px;font-size:15px;color:#12161c;line-height:1.5">${esc(greeting)}</p>
${lines.map((l) => `<p style="margin:0 0 14px;font-size:15px;color:#12161c;line-height:1.5">${l}</p>`).join("")}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${detailRows}</table>
<div style="margin:0 0 8px">${buttonHtml}</div>
</td></tr>
<tr><td style="padding:12px 28px 24px;font-size:13px;color:#5a6472;line-height:1.5">${esc(footnote)}<br>ACL Propiedades · Torreón, Gómez Palacio y Lerdo</td></tr>
</table></td></tr></table></body></html>`;
}

const stripLines = (lines) => lines.map((l) => l.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"));

/**
 * Arma el correo de un tipo: "solicitud" (pidió una visita sin asesor), "confirmacion",
 * "reprogramada", "cancelacion", "recordatorio24h" o "recordatorio2h".
 * Devuelve { subject, html, text, attachments }.
 * Los datos que escribió el visitante (nombre) y los de la propiedad van escapados; el
 * motivo de una cancelación NO se incluye (el asesor puede haber escrito notas internas).
 */
export function buildVisitEmail(kind, cita, { siteUrl = DEFAULT_SITE_URL, now = new Date() } = {}) {
  const label = visitLabel(cita.property);
  const when = `${capitalize(formatVisitDay(cita.fecha))} · ${formatVisitTime(cita.hora)}`;
  const greeting = firstName(cita.contact_name) ? `Hola, ${firstName(cita.contact_name)}.` : "Hola.";
  const manage = manageUrl(siteUrl, cita.booking_token);
  const map = mapsUrl(cita.property?.address);
  const details = [
    ["Cuándo", esc(when)],
    ["Propiedad", esc(label)],
    ...(cita.property?.address ? [["Dónde", esc(cita.property.address)]] : []),
    ...(cita.advisor?.name ? [["Te atiende", esc(cita.advisor.name)]] : []),
  ];
  const manageButton = { href: manage, label: "Ver, cambiar o cancelar mi visita", primary: true };
  const mapButton = map ? [{ href: map, label: "Cómo llegar", primary: false }] : [];
  const changeNote = "Puedes cambiar el horario hasta 2 horas antes de la visita (máximo 2 veces) y cancelarla en cualquier momento desde el botón de arriba.";

  let spec;
  let attachments = [];
  switch (kind) {
    case "solicitud":
      // Solicitud sin asesor: todavía NO es una visita agendada (no lleva calendario ni "te atiende").
      spec = {
        subject: `Recibimos tu solicitud de visita — ${label}`,
        preheader: `Pediste visitar el ${when}. Un asesor la tomará y te confirmará por correo.`,
        heading: "¡Recibimos tu solicitud de visita!",
        lines: ["Pediste visitar la propiedad en el horario de abajo. Ya está con todos nuestros asesores: el primero que pueda atenderte la toma y te confirma por correo. <strong>Todavía no está confirmada.</strong>"],
        buttons: [{ href: manage, label: "Ver o cancelar mi solicitud", primary: true }, ...mapButton],
        footnote: "Si cambias de opinión, puedes cancelarla desde el botón de arriba. Te escribiremos pronto.",
      };
      details[0] = ["Horario que pediste", esc(when)];
      break;
    case "confirmacion":
      spec = {
        subject: `Tu visita está agendada — ${label}`,
        preheader: `${when}. Guarda este correo: desde aquí puedes cambiar o cancelar tu visita.`,
        heading: "¡Tu visita está agendada!",
        lines: ["Te esperamos para conocer la propiedad. Agrégala a tu calendario con el archivo adjunto."],
        buttons: [manageButton, ...mapButton],
        footnote: changeNote,
      };
      attachments = [{ filename: "visita.ics", content: toBase64(buildVisitIcs(cita, { siteUrl, now })) }];
      break;
    case "reprogramada":
      spec = {
        subject: `Cambiamos tu visita — ${label}`,
        preheader: `Nuevo horario: ${when}.`,
        heading: "Tu visita tiene un nuevo horario",
        lines: ["Este es el nuevo horario de tu visita. El archivo adjunto actualiza tu calendario."],
        buttons: [manageButton, ...mapButton],
        footnote: changeNote,
      };
      attachments = [{ filename: "visita.ics", content: toBase64(buildVisitIcs(cita, { siteUrl, now })) }];
      break;
    case "cancelacion": {
      const byAdvisor = cita.cancelled_by === "asesor";
      spec = {
        subject: `Visita cancelada — ${label}`,
        preheader: byAdvisor ? "Tuvimos que cancelar tu visita. Agenda otra cuando gustes." : "Confirmamos la cancelación de tu visita.",
        heading: "Tu visita fue cancelada",
        lines: [
          byAdvisor
            ? "Lamentamos el inconveniente: tuvimos que cancelar tu visita. Con gusto la reagendamos; elige un nuevo horario cuando quieras."
            : "Confirmamos la cancelación de tu visita y liberamos el horario. Si todavía quieres conocer la propiedad, agenda otra cuando gustes.",
          "Si la tenías en tu calendario, puedes eliminarla.",
        ],
        buttons: [{ href: propertyUrl(siteUrl, cita.property), label: "Agendar otra visita", primary: true }],
        footnote: "Si fue un error o necesitas ayuda, responde a este correo o escríbenos por WhatsApp.",
      };
      // Una visita cancelada ya no tiene "cuándo" vigente: se muestra como dato de lo que se canceló.
      details[0] = ["Era el", esc(when)];
      break;
    }
    case "recordatorio24h":
      spec = {
        subject: `Recordatorio: tu visita es mañana — ${label}`,
        preheader: `${when}. Confirma que podrás asistir.`,
        heading: "Te recordamos tu visita",
        lines: ["Tu visita es en aproximadamente un día. <strong>Confirma que podrás asistir</strong> desde el botón; si no puedes, cámbiala o cancélala para liberar el horario."],
        buttons: [{ ...manageButton, label: "Confirmar asistencia o cambiar" }, ...mapButton],
        footnote: changeNote,
      };
      break;
    case "recordatorio2h":
      spec = {
        subject: `Tu visita es en 2 horas — ${label}`,
        preheader: `${when}.`,
        heading: "Tu visita es en 2 horas",
        lines: ["Ya casi es hora. Aquí tienes los datos para llegar."],
        buttons: [...mapButton, { ...manageButton, primary: !map }],
        footnote: "Si no puedes asistir, cancela desde el botón para que otra persona pueda usar el horario.",
      };
      break;
    default:
      throw new Error(`Tipo de correo desconocido: ${kind}`);
  }

  const html = renderHtml({ preheader: spec.preheader, heading: spec.heading, greeting, lines: spec.lines, details, buttons: spec.buttons, footnote: spec.footnote });
  const text = [
    spec.heading,
    "",
    greeting,
    ...stripLines(spec.lines),
    "",
    ...details.map(([l, v]) => `${l}: ${v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")}`),
    "",
    ...spec.buttons.map((b) => `${b.label}: ${b.href}`),
    "",
    spec.footnote,
    "ACL Propiedades · Torreón, Gómez Palacio y Lerdo",
  ].join("\n");

  return { subject: spec.subject, html, text, attachments };
}
