// Importar y pegar prospectos: el asesor pega un texto (nombres y teléfonos de un chat o una lista de WhatsApp, contactos
// compartidos como tarjetas vCard) o sube un CSV (Facebook Lead Ads, una hoja de cálculo) y de ahí salen los prospectos, que se
// revisan antes de guardar. Funciones puras: la ventana (ProspectImportModal) solo las pinta.

import { phoneKey, emailKey } from "./duplicates";
import { whatsappDigits } from "./format";

export const MAX_IMPORT_ROWS = 200;
export const IMPORT_SOURCE = "importado";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{8,}\d/g;

const noAccents = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// Teléfono mexicano a 10 dígitos ("+52 871 123 4567", "(871) 123-4567", "52 1 871 1234567", "044 871…", "p:+52871…"). null si no
// es un teléfono de 10 dígitos.
export function normalizePhone(raw) {
  let digits = whatsappDigits(raw);
  if (digits.length === 13 && ["521", "044", "045"].some((prefix) => digits.startsWith(prefix))) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
  return digits.length === 10 ? digits : null;
}

// El primer teléfono válido de un texto, o null. Un número pegado a otros dígitos («Persona 3 871 123 4567») se busca también
// quitando grupos del principio o del final del candidato.
function findPhone(text) {
  for (const candidate of String(text || "").match(PHONE_CANDIDATE_RE) || []) {
    const groups = candidate.trim().split(/\s+/);
    for (let start = 0; start < groups.length; start += 1) {
      for (let end = groups.length; end > start; end -= 1) {
        const piece = groups.slice(start, end).join(" ");
        const phone = normalizePhone(piece);
        if (phone) return { phone, candidate: piece };
      }
    }
  }
  return null;
}

const LABEL_RE = /\b(?:tel[eé]fono|tel|cel(?:ular)?|m[oó]vil|whatsapp|wa|n[uú]mero|contacto|nombre|name|correo|e-?mail|email)\s*:/gi;
const CHAT_PREFIX_RE = /^\s*\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?/i;
const BULLET_RE = /^\s*(?:\d+[.)]|[-•*·–—])\s+/;

// El nombre que queda de una línea al quitarle teléfono, correo, etiquetas («Tel:»), viñetas y la fecha de un chat.
function cleanName(line) {
  const name = String(line || "")
    .replace(CHAT_PREFIX_RE, "")
    .replace(BULLET_RE, "")
    .replace(LABEL_RE, " ")
    .replace(/[~:;,|/\\()[\]<>"“”]/g, " ")
    .replace(/\s-\s|^-|-$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /\p{L}/u.test(name) ? name : "";
}

// ¿Un renglón que solo trae un nombre (sin teléfono) puede ser el nombre del teléfono que viene en el renglón siguiente?
const looksLikeName = (name) => name.length <= 60 && name.split(" ").length <= 5 && !/\d/.test(name);

const baseRow = (over) => ({ name: "", phone: "", email: "", notes: "", looking_for: "", ...over });

// ── Texto pegado ──

function parseText(text) {
  const rows = [];
  let pendingName = "";
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const email = (line.match(EMAIL_RE) || [])[0] || "";
    const found = findPhone(line.replace(email, " "));
    const rest = cleanName(line.replace(email, " ").replace(found?.candidate || "\u0000", " "));
    if (found || email) {
      rows.push(baseRow({ name: rest || (looksLikeName(pendingName) ? pendingName : ""), phone: found?.phone || "", email }));
      pendingName = "";
    } else if (rest) {
      pendingName = rest;
    }
  }
  return rows;
}

// ── vCard (contactos compartidos) ──

function parseVcard(text) {
  const rows = [];
  const unfolded = String(text || "").replace(/\r?\n[ \t]/g, "");
  for (const card of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
    const field = (key) => (card.match(new RegExp(`^${key}[^:\\n]*:(.*)$`, "im")) || [])[1]?.trim() || "";
    let name = field("FN");
    if (!name) name = field("N").split(";").filter(Boolean).reverse().join(" ").trim();
    const email = field("EMAIL");
    let phone = "";
    for (const tel of card.match(/^TEL[^:\n]*:(.*)$/gim) || []) {
      phone = normalizePhone(tel.slice(tel.indexOf(":") + 1)) || "";
      if (phone) break;
    }
    if (phone || email) rows.push(baseRow({ name, phone, email }));
  }
  return rows;
}

// ── CSV ──

// Separador más probable de la primera línea (fuera de comillas); null si no hay.
function detectDelimiter(text) {
  const first = String(text || "").split(/\r?\n/).find((l) => l.trim()) || "";
  let best = null;
  let bestCount = 0;
  for (const delimiter of [",", ";", "\t"]) {
    let count = 0;
    let quoted = false;
    for (const ch of first) {
      if (ch === '"') quoted = !quoted;
      else if (ch === delimiter && !quoted) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

// RFC 4180: comillas, comillas escapadas ("") y saltos de línea dentro de una celda.
export function parseCsv(text, delimiter = detectDelimiter(text) || ",") {
  const source = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const HEADERS = {
  name: /^(nombre completo|nombre|name|full[ _]?name|contacto|cliente|prospecto)$/,
  firstName: /^(first[ _]?name|nombres?|primer nombre)$/,
  lastName: /^(last[ _]?name|apellidos?)$/,
  phone: /^(telefono|tel|celular|movil|whatsapp|phone|phone[ _]?number|numero|numero de telefono|telefono celular)$/,
  email: /^(correo|correo electronico|email|e[- ]?mail|mail)$/,
  notes: /^(notas?|comentarios?|mensaje|message|observaciones)$/,
  looking_for: /^(busca|que busca|interes|interesado en|propiedad|looking[ _]?for)$/,
};

const headerKey = (cell) => noAccents(cell).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function mapHeaders(headerRow) {
  const map = {};
  headerRow.forEach((cell, index) => {
    const key = headerKey(cell);
    for (const [field, re] of Object.entries(HEADERS)) {
      if (map[field] == null && (re.test(key) || re.test(key.replace(/ /g, "_")))) map[field] = index;
    }
  });
  return map;
}

function rowFromCells(cells, map) {
  const cell = (field) => (map[field] != null ? String(cells[map[field]] ?? "").trim() : "");
  const first = cell("firstName");
  const last = cell("lastName");
  const rawPhone = cell("phone");
  return baseRow({
    name: cell("name") || [first, last].filter(Boolean).join(" "),
    phone: normalizePhone(rawPhone) || (rawPhone ? rawPhone.replace(/^p:/i, "") : ""),
    email: (cell("email").match(EMAIL_RE) || [])[0] || "",
    notes: cell("notes"),
    looking_for: cell("looking_for"),
  });
}

function parseCsvRows(text) {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], hasHeader: false };
  const map = mapHeaders(table[0]);
  const recognized = ["name", "firstName", "phone", "email"].filter((f) => map[f] != null).length;
  // Hay encabezado si el primer renglón nombra un teléfono o un correo (o dos columnas conocidas): una lista de texto
  // cualquiera, aunque lleve comas, no lo tiene y se lee renglón por renglón.
  const hasHeader = recognized >= 1 && (map.phone != null || map.email != null || recognized >= 2);
  return { rows: hasHeader ? table.slice(1).map((cells) => rowFromCells(cells, map)) : [], hasHeader };
}

// ── Entrada ──

// → { kind: "vcard" | "csv" | "text", rows: [{ id, name, phone, email, notes, looking_for, repeated }], truncated }.
// Los renglones sin nombre ni teléfono ni correo se descartan; se toman a lo más MAX_IMPORT_ROWS.
export function parseProspectInput(text) {
  const input = String(text || "");
  let kind = "text";
  let rows;
  if (/BEGIN:VCARD/i.test(input)) {
    kind = "vcard";
    rows = parseVcard(input);
  } else {
    const csv = parseCsvRows(input);
    if (csv.hasHeader) {
      kind = "csv";
      rows = csv.rows;
    } else {
      rows = parseText(input);
    }
  }
  rows = rows.filter((r) => r.name || r.phone || r.email);
  const truncated = rows.length > MAX_IMPORT_ROWS;
  return { kind, rows: markRepeats(rows.slice(0, MAX_IMPORT_ROWS).map((r, i) => ({ ...r, id: i }))), truncated };
}

// Repite el mismo teléfono (últimos 10 dígitos) o correo que un renglón anterior de la lista: se marca para no importarlo dos veces.
export function markRepeats(rows) {
  const seenPhones = new Set();
  const seenEmails = new Set();
  return rows.map((row) => {
    const pk = phoneKey(row.phone);
    const ek = emailKey(row.email);
    const repeated = Boolean((pk && seenPhones.has(pk)) || (ek && seenEmails.has(ek)));
    if (pk) seenPhones.add(pk);
    if (ek) seenEmails.add(ek);
    return { ...row, repeated };
  });
}

// Lo que falta o está mal en un renglón: noName | badPhone | noContact (ni teléfono válido ni correo).
export function rowIssues(row) {
  const issues = [];
  const phoneOk = Boolean(normalizePhone(row.phone));
  const emailOk = Boolean(String(row.email || "").match(EMAIL_RE));
  if (!String(row.name || "").trim()) issues.push("noName");
  if (String(row.phone || "").trim() && !phoneOk) issues.push("badPhone");
  if (!phoneOk && !emailOk) issues.push("noContact");
  return issues;
}

export const isImportable = (row) => rowIssues(row).length === 0;

// Campos de `prospectos` listos para db.addProspects. El teléfono sale normalizado (10 dígitos).
export function prospectFieldsFromRow(row, { advisorId = null, source = IMPORT_SOURCE } = {}) {
  const email = String(row.email || "").trim();
  return {
    name: String(row.name).trim(),
    phone: normalizePhone(row.phone) || null,
    email: email || null,
    source,
    stage: "nuevo",
    advisor_id: advisorId || null,
    property_id: null,
    looking_for: String(row.looking_for || "").trim() || null,
    notes: String(row.notes || "").trim() || null,
    last_contact_at: null,
    next_followup_at: null,
    lost_reason: null,
  };
}
