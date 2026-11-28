// Renglón corto de la lista de propiedades del panel: quién la lleva y cuántos días lleva publicada.
// `advisors`: lista de asesores; `property.advisor_ids`: ids asignados. Devuelve nombres (primero el primero) y días.
export function advisorNames(advisorIds, advisors) {
  const byId = new Map((advisors || []).map((a) => [a.id, a.name]));
  return (advisorIds || []).map((id) => byId.get(id)).filter(Boolean);
}

// «Ana López y 1 más» cuando hay varios, para no estirar la fila.
export function advisorSummary(names, andMore) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  return `${names[0]} ${andMore(names.length - 1)}`;
}
