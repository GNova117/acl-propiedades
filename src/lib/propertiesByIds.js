import { db } from "./dataStore";

// Las propiedades de una lista de ids (favoritos, comparación, selección, vistas recientes) en UNA consulta y en el orden de la lista.
// Antes se pedía cada una por separado (N consultas). Una que ya no existe o está desactivada simplemente no sale.
export async function loadPropertiesInOrder(ids) {
  const wanted = (ids || []).filter(Boolean);
  if (wanted.length === 0) return [];
  const rows = await db.getPropertiesByIds(wanted).catch(() => []);
  const byId = new Map(rows.map((property) => [property.id, property]));
  return wanted.map((id) => byId.get(id)).filter(Boolean);
}
