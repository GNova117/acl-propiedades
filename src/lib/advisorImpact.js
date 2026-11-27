// Qué se queda sin responsable cuando se desactiva a un asesor: sus citas por venir, sus prospectos abiertos y sus propiedades.
// Funciones puras: reciben las listas ya cargadas.
const OPEN_STAGES_EXCLUDED = new Set(["cerrado", "ganado", "perdido", "descartado"]);

export function advisorImpact(advisorId, { citas = [], prospects = [], properties = [] } = {}, today = new Date().toLocaleDateString("en-CA")) {
  const upcomingCitas = citas.filter((c) => c.advisor_id === advisorId && c.fecha >= today && !["cancelada", "realizada", "no_asistio"].includes(c.status)).length;
  const openProspects = prospects.filter((p) => p.advisor_id === advisorId && !OPEN_STAGES_EXCLUDED.has(p.stage)).length;
  const ownedProperties = properties.filter((p) => (p.advisor_ids || []).includes(advisorId)).length;
  return { upcomingCitas, openProspects, ownedProperties, total: upcomingCitas + openProspects + ownedProperties };
}
