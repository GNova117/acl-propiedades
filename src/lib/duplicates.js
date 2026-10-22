// ¿Este contacto ya existe? Compara por teléfono (últimos 10 dígitos, así
// "+52 871 123 4567" y "8711234567" son el mismo) o por correo, contra los
// prospectos y los clientes. Funciones puras: el modo demo las usa directo
// sobre sus datos; contra Supabase la misma regla vive en la función SQL
// find_contact_duplicates() (schema.sql, "Contactos duplicados") porque un
// asesor solo puede leer sus propios prospectos y ahí hay que ver los de todos.
// Si cambia la regla aquí, cambia allá.

import { whatsappDigits } from "./format";

// Últimos 10 dígitos del teléfono; null si no hay 10 (no sirve para comparar).
export function phoneKey(phone) {
  const digits = whatsappDigits(phone);
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export const emailKey = (email) => String(email || "").trim().toLowerCase() || null;

// Coincidencias de { phone, email } entre `prospects` y `clients` (filas tal
// como están en la base). `excludeProspectId`: el prospecto que se está editando.
// `myAdvisorId`: null = oficina (ve todo, "mine" siempre true).
// Cada una: { kind: "prospect" | "client", id, name, stage, advisor_name, mine, matched: "phone" | "email" }.
// El id de un prospecto ajeno no se entrega (no se puede abrir): solo se avisa que existe.
export function findDuplicates({ phone, email }, { prospects = [], clients = [], advisors = [], excludeProspectId = null, myAdvisorId = null } = {}) {
  const pk = phoneKey(phone);
  const ek = emailKey(email);
  if (!pk && !ek) return [];
  const matchedBy = (row) => (pk && phoneKey(row.phone) === pk ? "phone" : ek && emailKey(row.email) === ek ? "email" : null);
  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || null;

  const found = [];
  for (const p of prospects) {
    if (p.id === excludeProspectId) continue;
    const matched = matchedBy(p);
    if (!matched) continue;
    const mine = myAdvisorId == null || p.advisor_id === myAdvisorId;
    found.push({ kind: "prospect", id: mine ? p.id : null, name: p.name, stage: p.stage, advisor_name: advisorName(p.advisor_id), mine, matched });
  }
  for (const c of clients) {
    const matched = matchedBy(c);
    if (matched) found.push({ kind: "client", id: c.id, name: c.name, stage: null, advisor_name: null, mine: true, matched });
  }
  return found.slice(0, 5);
}
