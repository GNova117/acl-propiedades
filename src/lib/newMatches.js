// «Propiedades nuevas para tus prospectos»: las propiedades publicadas en los últimos días que encajan con lo que
// busca un prospecto abierto (mismo cruce de siempre, lib/prospectMatch.js). Es una lista que el asesor ve en Mi día,
// NO un aviso automático al cliente: avisarle es decisión del asesor (un clic arma el mensaje). Lo que ya se avisó
// u ocultó no vuelve a salir (se guarda en este dispositivo, por asesor).
import { matchingProperties } from "./prospectMatch";

export const NEW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const dismissKey = (prospectId, propertyId) => `${prospectId}:${propertyId}`;

export const isRecent = (property, now = new Date(), days = NEW_DAYS) => {
  const created = new Date(property?.created_at || "").getTime();
  return Number.isFinite(created) && now.getTime() - created <= days * DAY_MS && created <= now.getTime() + DAY_MS;
};

// → [{ prospect, properties }] con los prospectos más avanzados en el embudo primero (el orden de la lista de
// entrada se respeta; viene ordenada por etapa desde quien llama si hace falta) y solo los que tienen algo nuevo.
export function newMatches(prospects, properties, { now = new Date(), dismissed = new Set(), days = NEW_DAYS } = {}) {
  const recent = properties.filter((p) => isRecent(p, now, days));
  if (recent.length === 0) return [];
  const out = [];
  for (const prospect of prospects) {
    const found = matchingProperties(prospect, recent).filter((p) => !dismissed.has(dismissKey(prospect.id, p.id)));
    if (found.length > 0) out.push({ prospect, properties: found });
  }
  return out;
}

const storageKey = (scope) => `acl.newMatches.dismissed.${scope || "all"}`;

export function loadDismissed(scope, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const raw = JSON.parse(storage?.getItem(storageKey(scope)) || "[]");
    return new Set(Array.isArray(raw) ? raw.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

// Guarda lo ocultado (máximo 500 para que no crezca sin fin; se queda con lo más reciente).
export function saveDismissed(scope, set, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    storage?.setItem(storageKey(scope), JSON.stringify([...set].slice(-500)));
  } catch {
    // sin almacenamiento: se vuelve a mostrar en la próxima visita, no pasa nada.
  }
}
