// Cotejo de inspección previo a avalúo: checklist por categorías, cada
// criterio se responde Sí/No (algunos también N/A) y opcionalmente lleva una
// foto. El estatus (verde/amarillo/rojo) se recalcula siempre a partir del
// checklist — nunca se confía en un valor guardado aparte que pueda
// desincronizarse.
//
// La clasificación crítico/no-crítico de cada criterio es una decisión de
// negocio que no vino especificada punto por punto: se infirió de los
// ejemplos del spec original (ver README / conversación) — "sin ventilación
// en baño, sin servicios básicos, humedad grave o daño en losa" como rojo;
// "falta cristal, falta pintura, falta llave de agua" como amarillo. Ajustar
// aquí (el flag `critical`) si el negocio pide otro criterio.
export const INSPECTION_CATEGORIES = [
  {
    key: "estructura",
    items: [
      { key: "grietas", critical: true },
      { key: "aplanados", critical: false },
      { key: "uso_habitacional", critical: true },
    ],
  },
  {
    key: "servicios",
    items: [
      { key: "agua", critical: true },
      { key: "drenaje", critical: true },
      { key: "electrica", critical: true },
      { key: "gas", critical: true, allowNA: true },
    ],
  },
  {
    key: "habitabilidad",
    items: [
      { key: "espacios_minimos", critical: true },
      { key: "ventanas", critical: false },
      { key: "ventilacion_banos", critical: true },
    ],
  },
  {
    key: "exteriores",
    items: [
      { key: "acceso_vial", critical: true },
      { key: "banqueta", critical: false },
      { key: "puerta_cerradura", critical: false },
    ],
  },
];

export function findItemConfig(category, key) {
  const cat = INSPECTION_CATEGORIES.find((c) => c.key === category);
  return cat?.items.find((i) => i.key === key) || null;
}

// Fila de trabajo en el formulario: además de lo que se guarda (category,
// key, estado, file_path) puede traer `file` (foto nueva sin subir aún),
// `signed_url` (para mostrarla) y `removed` (el usuario quitó la foto que
// ya había). Esos tres campos se limpian antes de guardar.
export function emptyChecklist() {
  return INSPECTION_CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => ({ category: cat.key, key: item.key, estado: "", file_path: null }))
  );
}

// Al editar, el checklist guardado puede no traer todas las filas (se agregó
// un criterio nuevo después de crear el registro) — se completa con las que
// falten en estado vacío, nunca se descartan las que ya no están en la
// configuración actual (para no perder una foto/respuesta ya capturada).
export function normalizeChecklist(saved) {
  const byKey = new Map((saved || []).map((e) => [`${e.category}.${e.key}`, e]));
  const current = emptyChecklist().map((row) => {
    const existing = byKey.get(`${row.category}.${row.key}`);
    byKey.delete(`${row.category}.${row.key}`);
    return existing ? { ...row, ...existing } : row;
  });
  return [...current, ...byKey.values()];
}

export function computeDiagnosis(checklist) {
  let critical = false;
  let minor = false;
  for (const entry of checklist) {
    if (entry.estado !== "no") continue;
    const config = findItemConfig(entry.category, entry.key);
    if (config?.critical ?? true) critical = true;
    else minor = true;
  }
  if (critical) return "rojo";
  if (minor) return "amarillo";
  return "verde";
}

export function failedItems(checklist) {
  return checklist.filter((e) => e.estado === "no");
}

export function isChecklistComplete(checklist) {
  return checklist.every((e) => e.estado === "si" || e.estado === "no" || e.estado === "na");
}

export function validateInspectionForm(form) {
  const errors = {};
  if (!form.folio.trim()) errors.folio = true;
  if (!form.direccion.trim()) errors.direccion = true;
  if (!form.inspector.trim()) errors.inspector = true;
  if (!form.visited_at) errors.visited_at = true;
  if (!isChecklistComplete(form.checklist)) errors.checklist = true;
  return errors;
}

export function generateFolio(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INSP-${y}${m}${d}-${rand}`;
}

export function toLocalInputValue(iso) {
  const date = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function emptyInspectionForm({ property_id = "", direccion = "", inspector = "" } = {}) {
  return {
    folio: generateFolio(),
    property_id,
    direccion,
    inspector,
    visited_at: toLocalInputValue(),
    checklist: emptyChecklist(),
    observaciones: "",
    signature: null, // { image, signedAt } cuando se acaba de firmar en esta sesión
    existingSignature: null, // signature_data ya guardada (al editar, sin volver a firmar)
    signedBy: "",
  };
}

export function inspectionToForm(inspection) {
  return {
    folio: inspection.folio,
    property_id: inspection.property_id || "",
    direccion: inspection.direccion,
    inspector: inspection.inspector,
    visited_at: toLocalInputValue(inspection.visited_at),
    checklist: normalizeChecklist(inspection.checklist),
    observaciones: inspection.observaciones || "",
    signature: null,
    existingSignature: inspection.signature_data || null,
    signedBy: inspection.signed_by || "",
  };
}

// Deja el checklist listo para el backend: quita `file`/`signed_url`
// (transitorios de UI) y traduce `removed` a file_path: null explícito.
export function toChecklistFields(checklist) {
  return checklist.map((entry) => ({
    category: entry.category,
    key: entry.key,
    estado: entry.estado,
    file: entry.file || null,
    file_path: entry.removed ? null : entry.file_path || null,
    removed: Boolean(entry.removed),
  }));
}

export function toInspectionFields(form) {
  const checklist = toChecklistFields(form.checklist);
  return {
    folio: form.folio.trim(),
    property_id: form.property_id || null,
    direccion: form.direccion.trim(),
    inspector: form.inspector.trim(),
    visited_at: new Date(form.visited_at).toISOString(),
    checklist,
    estatus: computeDiagnosis(checklist),
    observaciones: form.observaciones.trim() || null,
    signature_data: form.signature?.image || form.existingSignature || null,
    signed_by: form.signature ? form.inspector.trim() : form.signedBy || null,
  };
}

export const STATUS_ORDER = ["verde", "amarillo", "rojo"];
