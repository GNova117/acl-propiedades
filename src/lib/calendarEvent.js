// Cita de la Agenda → archivo de calendario (.ics) que abren Google Calendar,
// Apple Calendar y Outlook, con alarmas para que el teléfono avise aunque el
// panel esté cerrado. Funciones puras (el navegador solo descarga el texto).
// Las horas van "flotantes" (sin zona): el calendario las toma en la hora local
// de quien las abre, que es la de la cita.

const pad2 = (n) => String(n).padStart(2, "0");

// Escapa lo que el formato reserva (\ ; , y saltos de línea).
const escapeText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Las líneas de más de 75 caracteres se parten con CRLF + espacio.
function fold(line) {
  const parts = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

const stamp = (date) =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;

const localStamp = (date) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}00`;

const dateOnly = (date) => `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;

// Enlace de Google Maps a un lugar escrito a mano (dirección o referencia).
// null si no hay lugar. Si ya es un enlace, se respeta tal cual.
export function mapsUrl(lugar) {
  const text = String(lugar || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export const DEFAULT_DURATION_MINUTES = 60;
// Avisos antes de una cita con hora (minutos); en una cita sin hora, a las 9:00 del mismo día.
export const ALARM_MINUTES = [60, 15];

// `cita`: fila de agenda_citas ({ id, titulo, fecha "YYYY-MM-DD", hora "HH:MM[:SS]" | null, lugar, actividades }).
// `extra`: { clientName, clientPhone, advisorName } para armar la descripción.
export function citaToIcs(cita, { clientName = "", clientPhone = "", advisorName = "", now = new Date() } = {}) {
  const [y, m, d] = String(cita.fecha).split("-").map(Number);
  const timed = Boolean(cita.hora);
  const [hh, mm] = timed ? String(cita.hora).split(":").map(Number) : [0, 0];
  const start = new Date(y, m - 1, d, hh, mm);
  const description = [
    clientName ? `Cliente: ${clientName}${clientPhone ? ` (${clientPhone})` : ""}` : null,
    advisorName ? `Asesor: ${advisorName}` : null,
    cita.actividades ? String(cita.actividades) : null,
    mapsUrl(cita.lugar) ? `Cómo llegar: ${mapsUrl(cita.lugar)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = ["BEGIN:VEVENT", `UID:${cita.id}@aclpropiedades`, `DTSTAMP:${stamp(now)}`];
  if (timed) {
    lines.push(`DTSTART:${localStamp(start)}`, `DTEND:${localStamp(new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`, `DTEND;VALUE=DATE:${dateOnly(new Date(y, m - 1, d + 1))}`);
  }
  lines.push(`SUMMARY:${escapeText(cita.titulo)}`);
  if (cita.lugar) lines.push(`LOCATION:${escapeText(cita.lugar)}`);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  const triggers = timed ? ALARM_MINUTES.map((min) => `-PT${min}M`) : ["PT9H"];
  for (const trigger of triggers) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(cita.titulo)}`, `TRIGGER:${trigger}`, "END:VALARM");
  }
  lines.push("END:VEVENT");

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ACL Propiedades//Agenda//ES", "CALSCALE:GREGORIAN", ...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}

// Descarga el .ics en el navegador.
export function downloadIcs(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
