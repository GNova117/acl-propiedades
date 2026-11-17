// Ofertas, contraofertas y apartados por propiedad. Funciones puras: validan lo que captura el asesor (la base
// valida lo mismo con CHECKs), cuentan la oferta más alta y dicen en qué estado va un apartado según su fecha.

export const OFFER_PARTIES = ["cliente", "propietario"];
export const OFFER_STATUSES = ["abierta", "aceptada", "rechazada", "retirada"];
export const HOLD_STATUSES = ["vigente", "concretado", "cancelado"];
export const HOLD_WARN_DAYS = 3; // «por vencer» faltando esto o menos

const NAME_MAX = 120;
const NOTE_MAX = 300;
const PHONE_MAX = 30;

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const toAmount = (value) => {
  const n = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

// → { value } con los campos limpios, o { error } con la clave del primer problema.
export function validateOffer({ party, buyerName, amount, note } = {}) {
  if (!OFFER_PARTIES.includes(party)) return { error: "party" };
  const name = clean(buyerName, NAME_MAX);
  if (!name) return { error: "name" };
  const value = toAmount(amount);
  if (!(value > 0)) return { error: "amount" };
  return { value: { party, buyer_name: name, amount: Math.round(value), note: clean(note, NOTE_MAX) || null } };
}

// `today`: "YYYY-MM-DD". La fecha límite no puede ser anterior a hoy; el monto puede ser 0 (apartado sin depósito).
export function validateHold({ buyerName, buyerPhone, amount, dueDate, note } = {}, today = new Date().toLocaleDateString("en-CA")) {
  const name = clean(buyerName, NAME_MAX);
  if (!name) return { error: "name" };
  const value = amount === "" || amount == null ? 0 : toAmount(amount);
  if (!(value >= 0)) return { error: "amount" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ""))) return { error: "date" };
  if (dueDate < today) return { error: "pastDate" };
  return { value: { buyer_name: name, buyer_phone: clean(buyerPhone, PHONE_MAX) || null, amount: Math.round(value), due_date: dueDate, note: clean(note, NOTE_MAX) || null } };
}

const dayNumber = (iso) => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);

// → { state: "vigente" | "porVencer" | "vencido" | "concretado" | "cancelado", daysLeft }
// `daysLeft` negativo = días de retraso. Solo un apartado vigente puede estar por vencer o vencido.
export function holdState(hold, today = new Date().toLocaleDateString("en-CA")) {
  if (!hold) return { state: "cancelado", daysLeft: 0 };
  if (hold.status === "concretado" || hold.status === "cancelado") return { state: hold.status, daysLeft: 0 };
  const daysLeft = dayNumber(hold.due_date) - dayNumber(today);
  if (daysLeft < 0) return { state: "vencido", daysLeft };
  if (daysLeft <= HOLD_WARN_DAYS) return { state: "porVencer", daysLeft };
  return { state: "vigente", daysLeft };
}

// Apartados vigentes que vencen pronto o ya vencieron, los más urgentes primero.
export function holdsNeedingAttention(holds, today = new Date().toLocaleDateString("en-CA")) {
  return holds
    .map((hold) => ({ hold, ...holdState(hold, today) }))
    .filter((e) => e.state === "porVencer" || e.state === "vencido")
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// Resumen de ofertas abiertas: la más alta del cliente y cuánto queda por debajo (o por encima) del precio de lista.
export function offersSummary(offers, listPrice) {
  const open = offers.filter((o) => o.status === "abierta");
  const clientOffers = open.filter((o) => o.party === "cliente");
  const best = clientOffers.reduce((top, o) => (!top || Number(o.amount) > Number(top.amount) ? o : top), null);
  const price = Number(listPrice);
  const pctVsList = best && price > 0 ? Math.round(((Number(best.amount) - price) / price) * 1000) / 10 : null;
  return { openCount: open.length, best, pctVsList };
}
