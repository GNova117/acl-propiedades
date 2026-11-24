// Fusión de dos prospectos duplicados: qué datos queda con el que se conserva. Espejo de la función SQL merge_prospects()
// (schema.sql) para el modo demo; si cambia una regla, cambia en la otra. Lo que el conservado ya tiene se respeta; los
// huecos se llenan con los del otro; las notas se juntan; la etapa es la más avanzada (perdido, la más baja); el
// seguimiento, el más próximo; el alta, la más antigua; el último contacto, el más reciente.

const RANKS = ["perdido", "nuevo", "contactado", "interesado", "negociacion", "cerrado"];
const blank = (v) => v == null || String(v).trim() === "";
const pick = (a, b) => (blank(a) ? b ?? null : a);
const earliest = (a, b) => (a && b ? (a < b ? a : b) : a || b || null);
const latest = (a, b) => (a && b ? (a > b ? a : b) : a || b || null);

export function mergedProspectFields(keep, remove, now = new Date().toISOString()) {
  const stage = RANKS.indexOf(remove.stage) > RANKS.indexOf(keep.stage) ? remove.stage : keep.stage;
  const removedNotes = blank(remove.notes) ? null : `Fusionado con «${remove.name}»: ${String(remove.notes).trim()}`;
  const notes = [blank(keep.notes) ? null : String(keep.notes).trim(), removedNotes].filter(Boolean).join("\n\n") || null;
  return {
    phone: pick(keep.phone, remove.phone),
    email: pick(keep.email, remove.email),
    looking_for: pick(keep.looking_for, remove.looking_for),
    property_id: keep.property_id ?? remove.property_id ?? null,
    visit_id: keep.visit_id ?? remove.visit_id ?? null,
    advisor_id: keep.advisor_id ?? remove.advisor_id ?? null,
    notes,
    stage,
    lost_reason: stage === "perdido" ? keep.lost_reason ?? remove.lost_reason ?? null : null,
    last_contact_at: latest(keep.last_contact_at, remove.last_contact_at),
    next_followup_at: earliest(keep.next_followup_at, remove.next_followup_at),
    created_at: earliest(keep.created_at, remove.created_at),
    updated_at: now,
  };
}

// ¿Puede quien llama fusionar estos dos? La oficina (myAdvisorId null) cualquiera; un asesor, solo los dos propios.
export function canMerge(keep, remove, myAdvisorId = null) {
  if (!keep || !remove || keep.id === remove.id) return false;
  return myAdvisorId == null || (keep.advisor_id === myAdvisorId && remove.advisor_id === myAdvisorId);
}
