// «Le encaja a tus prospectos»: cuando entra una propiedad nueva o baja de precio, a qué prospectos abiertos del asesor
// les va con lo que buscan (el cruce es el de prospectMatch.js: los mismos criterios que las alertas del sitio). Funciones
// puras; Mi día solo pinta el resultado y la campana cuenta cuántas propiedades hay por revisar.
//
// Una «novedad» es una propiedad disponible que se dio de alta o bajó de precio hace poco (MATCH_WINDOW_DAYS). Lo que el
// asesor ya revisó se recuerda en este dispositivo (`seen`, por cuenta): una novedad completa («Listo») o un prospecto
// concreto al que ya se le escribió. No se guarda en la base a propósito: es una ayuda para no repetir avisos, no un dato
// del negocio. La Edge Function `prospecto-coincidencias` usa las mismas reglas para el aviso push.

import { isAvailable } from "./alertMatch";
import { getPriceDrop } from "./propertyBadges";
import { matchingProspects } from "./prospectMatch";

export const MATCH_WINDOW_DAYS = 7;
const DAY_MS = 86400000;

// Lo revisado se olvida pasado este tiempo (la novedad ya salió de la ventana, no hace falta guardarlo).
const SEEN_KEEP_DAYS = 30;

const ageDays = (iso, now) => {
  const time = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(time) ? Infinity : (Number(now) - time) / DAY_MS;
};

// Novedades de propiedades: { kind: "new" | "priceDrop", property, at, percent?, previousPrice? }. Una propiedad que
// además de nueva bajó de precio cuenta como rebaja (es lo más reciente que le pasó).
export function freshEvents(properties, now = Date.now()) {
  const events = [];
  for (const property of properties || []) {
    if (!isAvailable(property)) continue;
    const drop = getPriceDrop(property, now);
    if (drop && ageDays(property.price_changed_at, now) <= MATCH_WINDOW_DAYS) {
      events.push({ kind: "priceDrop", property, at: property.price_changed_at, percent: drop.percent, previousPrice: drop.previousPrice });
    } else if (ageDays(property.created_at, now) <= MATCH_WINDOW_DAYS) {
      events.push({ kind: "new", property, at: property.created_at });
    }
  }
  return events;
}

export const eventKey = (event) => `${event.property.id}:${event.kind}:${event.at}`;
export const prospectKey = (key, prospectId) => `${key}|${prospectId}`;

// Qué hay por revisar: una entrada por novedad que le encaja a algún prospecto, lo más reciente primero. `prospects` ya
// viene del asesor (RLS: solo los suyos; la oficina ve todos). Solo cuentan prospectos abiertos con «qué busca» capturado.
export function matchAlerts({ properties, prospects, now = Date.now(), seen = {} }) {
  const alerts = [];
  for (const event of freshEvents(properties, now)) {
    const key = eventKey(event);
    if (seen[key]) continue;
    const list = matchingProspects(event.property, prospects || []).filter((p) => !seen[prospectKey(key, p.id)]);
    if (list.length > 0) alerts.push({ ...event, key, prospects: list });
  }
  return alerts.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// ── Lo ya revisado (localStorage, por cuenta) ───────────────────────────────

const storageKey = (email) => `acl_match_seen:${String(email || "").toLowerCase()}`;

export function pruneSeen(seen, now = Date.now()) {
  const kept = {};
  for (const [key, at] of Object.entries(seen || {})) {
    if (Number(now) - Number(at) <= SEEN_KEEP_DAYS * DAY_MS) kept[key] = at;
  }
  return kept;
}

export function readSeen(email, now = Date.now()) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(email)));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? pruneSeen(raw, now) : {};
  } catch {
    return {};
  }
}

// Marca una o varias llaves como revisadas y devuelve lo que quedó guardado (aunque no haya almacenamiento).
export function markSeen(email, keys, now = Date.now()) {
  const next = { ...readSeen(email, now) };
  for (const key of [].concat(keys)) next[key] = Number(now);
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(next));
  } catch {
    /* sin almacenamiento: lo revisado se olvida al recargar, nada más */
  }
  return next;
}
