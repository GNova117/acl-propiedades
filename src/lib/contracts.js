// Contrato de intermediación con el propietario (exclusiva o abierta) y su vencimiento. Funciones puras; la base
// valida lo mismo con CHECKs (tabla property_contracts, aparte de properties porque properties se lee en público).

export const CONTRACT_KINDS = ["exclusiva", "abierta"];
export const WARN_DAYS = 30; // «por vencer»
export const URGENT_DAYS = 7; // «urgente»
const NOTE_MAX = 300;

const dayNumber = (iso) => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);
const todayISO = () => new Date().toLocaleDateString("en-CA");

// → { value } limpio o { error: "kind" | "date" }. La fecha de vencimiento puede ser pasada (un contrato que ya venció
// sigue siendo un dato útil), pero tiene que ser una fecha.
export function validateContract({ kind, expiresOn, note } = {}) {
  if (!CONTRACT_KINDS.includes(kind)) return { error: "kind" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expiresOn || "")) || Number.isNaN(dayNumber(expiresOn))) return { error: "date" };
  return { value: { kind, expires_on: expiresOn, note: String(note ?? "").trim().slice(0, NOTE_MAX) || null } };
}

// → { state: "vigente" | "porVencer" | "urgente" | "vencido", daysLeft } (daysLeft negativo = días de retraso)
export function contractState(contract, today = todayISO()) {
  const daysLeft = dayNumber(contract.expires_on) - dayNumber(today);
  if (daysLeft < 0) return { state: "vencido", daysLeft };
  if (daysLeft <= URGENT_DAYS) return { state: "urgente", daysLeft };
  if (daysLeft <= WARN_DAYS) return { state: "porVencer", daysLeft };
  return { state: "vigente", daysLeft };
}

// Contratos que piden atención (por vencer, urgentes o vencidos), los que primero vencen arriba.
export function contractsNeedingAttention(contracts, today = todayISO()) {
  return contracts
    .map((contract) => ({ contract, ...contractState(contract, today) }))
    .filter((e) => e.state !== "vigente")
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
