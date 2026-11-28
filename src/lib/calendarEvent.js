// Cita de la Agenda → archivo de calendario (.ics) que abren Google Calendar,
// Apple Calendar y Outlook, con alarmas para que el teléfono avise aunque el
// panel esté cerrado. Funciones puras (el navegador solo descarga el texto).
// Las horas con hora de la cita van en UTC (terminan en Z) calculadas desde la hora de México: así el calendario del teléfono las
// muestra en la hora correcta aunque la persona esté en otra zona (un comprador de naves en EE. UU.). Antes iban «flotantes» y se
// veían corridas. Las citas de todo el día siguen siendo de fecha.
import { mexicoParts } from "./visitSlots.js";

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

// Fecha y hora de pared en México ("YYYY-MM-DD", hh, mm) → el instante real (Date). Se ajusta con la zona de ese día, así que
// funciona también con el horario de verano que México tuvo hasta 2022.
function mexicoWallToDate(y, m, d, hh, mm) {
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let t = target;
  for (let i = 0; i < 2; i += 1) {
    const { date, minutes } = mexicoParts(new Date(t));
    const [wy, wm, wd] = date.split("-").map(Number);
    t += target - (Date.UTC(wy, wm - 1, wd) + minutes * 60000);
  }
  return new Date(t);
}

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

// `cita`: fila de agenda_citas ({ id, titulo, fecha "YYYY-MM-DD", hora "HH:MM[:SS]" | null, duracion_min, lugar, actividades }).
// `extra`: { clientName, clientPhone, advisorName } para armar la descripción.
function citaToVevent(cita, { clientName = "", clientPhone = "", advisorName = "", now = new Date() } = {}) {
  const [y, m, d] = String(cita.fecha).split("-").map(Number);
  const timed = Boolean(cita.hora);
  const [hh, mm] = timed ? String(cita.hora).split(":").map(Number) : [0, 0];
  const start = timed ? mexicoWallToDate(y, m, d, hh, mm) : new Date(y, m - 1, d, hh, mm);
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
    const minutes = Number(cita.duracion_min) > 0 ? Number(cita.duracion_min) : DEFAULT_DURATION_MINUTES;
    lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + minutes * 60000))}`);
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
  return lines;
}

const calendar = (events, extraHeaders = []) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ACL Propiedades//Agenda//ES", "CALSCALE:GREGORIAN", ...extraHeaders, ...events.flat(), "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";

export function citaToIcs(cita, extra = {}) {
  return calendar([citaToVevent(cita, extra)]);
}

// Calendario suscribible (una URL que Google/Apple/Outlook vuelven a leer solos): todas las citas dadas en un
// solo .ics. A propósito NO lleva el teléfono del cliente: ese calendario vive en servicios de terceros.
export function citasToIcsFeed(citas, { name = "Agenda ACL Propiedades", now = new Date() } = {}) {
  return calendar(
    citas.map((cita) => citaToVevent(cita, { now })),
    [`X-WR-CALNAME:${escapeText(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"]
  );
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

// Enlace «Agregar a Google Calendar» de una cita con hora (la misma que descarga el .ics): título, fecha y hora de México en UTC, lugar y notas.
// null si la cita no tiene hora (las de todo el día se agregan con el archivo).
export function googleCalendarUrl(cita, { advisorName = "" } = {}) {
  if (!cita?.hora) return null;
  const [y, m, d] = String(cita.fecha).split("-").map(Number);
  const [hh, mm] = String(cita.hora).split(":").map(Number);
  const start = mexicoWallToDate(y, m, d, hh, mm);
  const minutes = Number(cita.duracion_min) > 0 ? Number(cita.duracion_min) : DEFAULT_DURATION_MINUTES;
  const end = new Date(start.getTime() + minutes * 60000);
  const details = [advisorName ? `Asesor: ${advisorName}` : null, cita.actividades ? String(cita.actividades) : null, mapsUrl(cita.lugar) ? `Cómo llegar: ${mapsUrl(cita.lugar)}` : null].filter(Boolean).join("\n");
  const params = new URLSearchParams({ action: "TEMPLATE", text: String(cita.titulo || ""), dates: `${stamp(start)}/${stamp(end)}` });
  if (cita.lugar) params.set("location", String(cita.lugar));
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
