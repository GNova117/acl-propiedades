// 450: comparar dos inspecciones de una misma propiedad (p. ej. al entrar y al salir un inquilino): qué criterios empeoraron, cuáles
// mejoraron y cuáles siguen igual, con la foto de cada una lado a lado. Solo cuenta lo que cambió de «Sí» a «No» (empeoró) o
// de «No» a «Sí» (mejoró); N/A y vacíos se muestran pero no cuentan como cambio de estado.
import { normalizeChecklist } from "./propertyInspection.js";


// → "worse" | "better" | "same" | "changed" (cambio que no es bueno ni malo, p. ej. N/A ↔ Sí)
export function changeOf(before, after) {
  if (before === after) return "same";
  if (before === "si" && after === "no") return "worse";
  if (before === "no" && after === "si") return "better";
  return "changed";
}

// before/after: inspecciones completas ({ checklist: [{ category, key, estado, file_path, signed_url }] }).
// → { rows: [{ category, key, before, after, change, beforePhoto, afterPhoto }], summary: { worse, better, same, changed } }
export function compareInspections(before, after) {
  const a = new Map(normalizeChecklist(before?.checklist).map((e) => [`${e.category}.${e.key}`, e]));
  const b = new Map(normalizeChecklist(after?.checklist).map((e) => [`${e.category}.${e.key}`, e]));
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  const rows = keys.map((id) => {
    const x = a.get(id);
    const y = b.get(id);
    const [category, ...rest] = id.split(".");
    const beforeState = x?.estado || "";
    const afterState = y?.estado || "";
    return {
      category,
      key: rest.join("."),
      before: beforeState,
      after: afterState,
      change: changeOf(beforeState, afterState),
      beforePhoto: x?.signed_url || null,
      afterPhoto: y?.signed_url || null,
    };
  });
  const summary = { worse: 0, better: 0, same: 0, changed: 0 };
  for (const row of rows) summary[row.change] += 1;
  return { rows, summary };
}

// Las que más importan primero: empeoraron, luego cambiaron, mejoraron y al final las iguales.
const ORDER = { worse: 0, changed: 1, better: 2, same: 3 };
export const sortByImportance = (rows) => rows.slice().sort((x, y) => ORDER[x.change] - ORDER[y.change]);

// Parejas posibles: inspecciones de la misma propiedad, de la más nueva a la más vieja. Devuelve [older, newer] sugeridas o null.
export function suggestPair(inspections, propertyId) {
  const same = (inspections || [])
    .filter((i) => i.property_id && i.property_id === propertyId)
    .slice()
    .sort((p, q) => new Date(q.visited_at) - new Date(p.visited_at));
  return same.length >= 2 ? [same[1], same[0]] : null;
}
