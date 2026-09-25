// Prospectos por etapas: helpers puros (sin acceso a datos) que usan la lista,
// el formulario, el panel de pendientes y la búsqueda global.

export const PROSPECT_STAGES = ["nuevo", "contactado", "interesado", "negociacion", "cerrado", "perdido"];
export const OPEN_STAGES = ["nuevo", "contactado", "interesado", "negociacion"];
export const PROSPECT_SOURCES = ["manual", "visita", "recomendacion", "redes", "sitio", "otro"];

export const isOpenStage = (stage) => OPEN_STAGES.includes(stage);

export const todayISO = () => new Date().toLocaleDateString("en-CA");

// Días enteros desde una fecha/hora ISO (0 = hoy). null si no hay fecha.
export function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(new Date()) - start(then)) / 86400000);
}

// Estado del seguimiento programado de un prospecto abierto:
// "overdue" (fecha pasada), "today" o null (sin fecha, futura o ya cerrado).
export function followUpState(prospect) {
  if (!isOpenStage(prospect.stage) || !prospect.next_followup_at) return null;
  const today = todayISO();
  if (prospect.next_followup_at < today) return "overdue";
  if (prospect.next_followup_at === today) return "today";
  return null;
}

// Etapa inicial sugerida al importar una visita (interés registrado en ella).
const VISIT_INTEREST_TO_STAGE = {
  muy_interesado: "interesado",
  interesado: "interesado",
  oferta_realizada: "negociacion",
  // Descartó ESA propiedad, pero la persona sigue marcada como posible cliente.
  descartado: "contactado",
};

// Campos de un prospecto nuevo a partir de una visita marcada como "posible
// cliente". No se copia el comentario público de la visita (es el que ve el
// vendedor), solo las notas internas.
export function visitToProspectFields(visit) {
  return {
    name: (visit.prospect_name || "").trim() || "Sin nombre",
    phone: visit.prospect_phone || null,
    email: null,
    source: "visita",
    stage: VISIT_INTEREST_TO_STAGE[visit.interest] || "nuevo",
    advisor_id: visit.advisor_id || null,
    property_id: visit.property_id || null,
    visit_id: visit.id,
    looking_for: visit.looking_for || null,
    notes: visit.internal_notes || null,
    last_contact_at: visit.visited_at || null,
    next_followup_at: null,
    lost_reason: null,
  };
}

export const emptyProspectForm = (overrides = {}) => ({
  name: "",
  phone: "",
  email: "",
  source: "manual",
  stage: "nuevo",
  advisor_id: "",
  property_id: "",
  looking_for: "",
  notes: "",
  next_followup_at: "",
  lost_reason: "",
  ...overrides,
});

export const prospectToForm = (p) => ({
  name: p.name || "",
  phone: p.phone || "",
  email: p.email || "",
  source: p.source || "manual",
  stage: p.stage || "nuevo",
  advisor_id: p.advisor_id || "",
  property_id: p.property_id || "",
  looking_for: p.looking_for || "",
  notes: p.notes || "",
  next_followup_at: p.next_followup_at || "",
  lost_reason: p.lost_reason || "",
});

const blank = (v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export function toProspectFields(form) {
  return {
    name: form.name.trim(),
    phone: blank(form.phone),
    email: blank(form.email),
    source: form.source || "manual",
    stage: form.stage,
    advisor_id: form.advisor_id || null,
    property_id: form.property_id || null,
    looking_for: blank(form.looking_for),
    notes: blank(form.notes),
    next_followup_at: form.next_followup_at || null,
    lost_reason: form.stage === "perdido" ? blank(form.lost_reason) : null,
  };
}

// Devuelve { campo: "clave i18n" } con los errores; vacío si todo está bien.
export function validateProspectForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "prospects.form.errors.name";
  if (!form.phone.trim() && !form.email.trim()) errors.phone = "prospects.form.errors.contact";
  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "prospects.form.errors.email";
  return errors;
}
