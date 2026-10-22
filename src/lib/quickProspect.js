// Captura rápida de un prospecto desde el celular: lo mínimo (nombre, teléfono,
// qué busca) y un campo para pegar el mensaje de WhatsApp tal cual, del que se
// saca el teléfono si no se escribió. Funciones puras.

import { whatsappDigits } from "./format";

// Primer teléfono mexicano de 10 dígitos que aparece en un texto pegado
// ("+52 871 123 4567", "(871) 123-4567", "52 1 871 1234567"…). null si no hay.
export function extractPhone(text) {
  const candidates = String(text || "").match(/\+?\d[\d\s().-]{8,}\d/g) || [];
  for (const candidate of candidates) {
    let digits = whatsappDigits(candidate);
    if (digits.length === 13 && digits.startsWith("521")) digits = digits.slice(3);
    else if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
    if (digits.length === 10) return digits;
  }
  return null;
}

// Errores como claves i18n; vacío si se puede guardar. Hace falta un nombre y
// algún medio de contacto (el teléfono escrito o el que sale del mensaje pegado).
export function validateQuickProspect({ name, phone, pasted }) {
  const errors = {};
  if (!String(name || "").trim()) errors.name = "quickCapture.errors.name";
  if (!String(phone || "").trim() && !extractPhone(pasted)) errors.phone = "quickCapture.errors.phone";
  return errors;
}

const blank = (v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

// Campos de `prospectos` listos para db.addProspect. El mensaje pegado se
// guarda en las notas; sin teléfono escrito se usa el que sale de él.
export function quickProspectFields({ name, phone, lookingFor, pasted }, { advisorId = null } = {}) {
  return {
    name: String(name).trim(),
    phone: blank(phone) || extractPhone(pasted),
    email: null,
    source: "manual",
    stage: "nuevo",
    advisor_id: advisorId || null,
    property_id: null,
    looking_for: blank(lookingFor),
    notes: blank(pasted),
    last_contact_at: null,
    next_followup_at: null,
    lost_reason: null,
  };
}
