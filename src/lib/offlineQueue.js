// Captura sin señal: lo que el asesor guarda cuando no hay conexión —un «Prospecto rápido», un «Registrar
// contacto» (incluidos los resultados de un toque), una visita nueva o una cita nueva de la Agenda— no se pierde
// ni lo hace esperar: queda en una cola en este dispositivo y se envía solo al volver la señal. Lo demás (editar,
// cambiar de etapa, notas…) sigue pidiendo conexión.
//
// Cuidados que importan:
//  - Duplicados. Cada prospecto, visita y cita lleva un id propio desde el primer intento (`fields.id`): si una
//    petición llegó pero se perdió la respuesta, el reenvío choca con ese id (código 23505) y se da por enviado.
//    Un contacto, antes de reenviarse, se busca en el historial del prospecto (`maybeSent`). Una visita que salió
//    de una cita, al enviarse, cierra el ciclo como siempre (cita realizada y prospecto al día; closeLoopAfterVisit,
//    que se puede repetir sin daño).
//  - Etapa. El contacto se vuelve a calcular AL ENVIARLO con el prospecto de ese momento (contactUpdate): si un
//    compañero lo movió de etapa mientras tanto, no se le hace retroceder. El último contacto sí lleva la hora real.
//  - Privacidad. La cola es de una cuenta (clave por correo): otra cuenta en el mismo dispositivo ni la ve ni la
//    envía; vive solo en este dispositivo (localStorage) hasta que se envía; al cerrar sesión con algo pendiente se
//    avisa. Un envío que falla por algo que no es la red (permiso, prospecto borrado…) no se pierde ni se
//    reintenta sin fin: queda marcado y el asesor decide (reintentar o descartar).
//  - Un solo envío a la vez, también entre pestañas (Web Locks), para no mandar dos veces lo mismo.

import { contactUpdate } from "./prospectContacts";
import { closeLoopAfterVisit } from "./visitProspect";

const KEY_PREFIX = "acl_offline_queue_v1:";
export const MAX_OPS = 200;
// Cuánto se espera a que responda el servidor antes de darlo por sin señal (con mala cobertura una petición se queda colgada).
export const SAVE_TIMEOUT_MS = 10 * 1000;
// Un contacto enviado con más retraso que esto lleva anotada la hora real en su nota (el historial guarda la de envío).
const DELAYED_MS = 5 * 60 * 1000;
// Ventana para reconocer que un contacto «dudoso» ya había llegado.
const SENT_WINDOW_MS = 60 * 1000;

export const OP_TYPES = ["prospect.add", "prospect.contact", "visit.add", "cita.add"];
const EMPTY = Object.freeze([]);

// ── Conexión y errores ──

export const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

// ¿Es un fallo de red (o de que el servidor no contestó a tiempo)? Esos se guardan en la cola; cualquier otro
// error (validación, permisos…) se muestra como siempre.
export function isOfflineError(err, online = isOnline()) {
  if (!online) return true;
  if (err?.name === "OfflineTimeout") return true;
  return /failed to fetch|network ?error|network request failed|load failed|fetch failed|networkerror|internet connection/i.test(String(err?.message ?? err ?? ""));
}

// Rechaza con OfflineTimeout si `promise` no termina en `ms`. La petición sigue su curso: puede haber llegado de
// todos modos, por eso lo guardado en la cola es idempotente (ver arriba).
export function withTimeout(promise, ms = SAVE_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { name: "OfflineTimeout" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const isDuplicateKey = (err) => err?.code === "23505" || /duplicate key/i.test(String(err?.message ?? ""));

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r % 4) + 8).toString(16);
  });
}

// ── Almacenamiento (por cuenta) ──

const cache = new Map(); // correo -> { raw, ops } (para devolver el mismo arreglo mientras no cambie)
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function subscribeQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Para avisar de un cambio hecho desde otra pestaña (evento «storage»).
export const notifyQueueChanged = emit;

const store = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const isOp = (op) => op && typeof op === "object" && typeof op.id === "string" && OP_TYPES.includes(op.type) && op.payload && typeof op.payload === "object";

// La cola de `email` (estable entre llamadas mientras no cambie). Un valor dañado se ignora sin romper nada.
export function getQueue(email) {
  const s = store();
  if (!s || !email) return EMPTY;
  let raw = null;
  try {
    raw = s.getItem(KEY_PREFIX + email);
  } catch {
    return EMPTY;
  }
  const hit = cache.get(email);
  if (hit && hit.raw === raw) return hit.ops;
  let ops = EMPTY;
  try {
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) ops = parsed.filter(isOp);
  } catch {
    ops = EMPTY;
  }
  cache.set(email, { raw, ops });
  return ops;
}

function write(email, ops) {
  const s = store();
  if (!s || !email) return false;
  try {
    if (ops.length === 0) s.removeItem(KEY_PREFIX + email);
    else s.setItem(KEY_PREFIX + email, JSON.stringify(ops));
  } catch {
    return false; // sin espacio o almacenamiento bloqueado
  }
  emit();
  return true;
}

// Agrega `op` ({ type, payload, label, maybeSent? }) al final de la cola. false si no se pudo guardar (sin
// cuenta, cola llena o sin almacenamiento): quien llama debe mostrar el error y NO dar el dato por guardado.
export function enqueue(email, op) {
  if (!email || !OP_TYPES.includes(op?.type)) return false;
  const ops = getQueue(email);
  if (ops.length >= MAX_OPS) return false;
  const entry = { id: newId(), createdAt: new Date().toISOString(), attempts: 0, failed: false, lastError: "", ...op };
  return write(email, [...ops, entry]);
}

export const enqueueProspect = (email, fields) => enqueue(email, { type: "prospect.add", label: fields.name, payload: { fields } });

// `prospect`: el prospecto como estaba al registrar el contacto (solo se usa su id y nombre: lo demás se recalcula al enviar).
export const enqueueContact = (email, { prospect, channel, note, nextFollowup, stage, maybeSent = false }) =>
  enqueue(email, { type: "prospect.contact", label: prospect.name, maybeSent, payload: { prospectId: prospect.id, channel, note: note ?? "", nextFollowup, stage } });

// Visita nueva (Visitas → Registrar visita). `fields.id` lo pone quien llama (newId()); `citaId`: la cita de la que salió, para cerrar el
// ciclo al enviarla; `can`: { agenda, prospectos } según los apartados del rol al registrarla.
export const enqueueVisit = (email, { fields, label, citaId = null, can = {} }) => enqueue(email, { type: "visit.add", label, payload: { fields, citaId, can } });

// Cita nueva de la Agenda. `fields.id` lo pone quien llama (newId()).
export const enqueueCita = (email, { fields, label }) => enqueue(email, { type: "cita.add", label, payload: { fields } });

export function removeOp(email, id) {
  const ops = getQueue(email);
  return write(email, ops.filter((op) => op.id !== id));
}

const patchOp = (email, id, patch) => write(email, getQueue(email).map((op) => (op.id === id ? { ...op, ...patch } : op)));

// Un envío que falló por algo que no es la red se puede volver a intentar.
export const retryOp = (email, id) => patchOp(email, id, { failed: false, lastError: "" });

// ── Envío ──

const defaultNoteSuffix = (date) => `(registrado sin conexión: ${date.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })})`;

// La nota del historial: si el contacto se envió con retraso, lleva anotada la hora real.
export function contactNote(op, noteSuffix = defaultNoteSuffix, now = Date.now()) {
  const note = String(op.payload.note ?? "").trim();
  const created = Date.parse(op.createdAt);
  if (Number.isNaN(created) || now - created <= DELAYED_MS) return note;
  return [note, noteSuffix(new Date(created))].filter(Boolean).join(" ");
}

// ¿El historial ya trae este contacto? (una petición que se dio por perdida pero sí llegó)
export function contactAlreadyLogged(contacts, op, noteSuffix = defaultNoteSuffix) {
  const created = Date.parse(op.createdAt);
  const plain = String(op.payload.note ?? "").trim();
  const accepted = new Set([plain, contactNote(op, noteSuffix)]);
  return contacts.some((c) => c.channel === op.payload.channel && accepted.has(String(c.note ?? "").trim()) && Date.parse(c.at) >= created - SENT_WINDOW_MS);
}

async function replayProspect(op, db) {
  try {
    await withTimeout(db.addProspect(op.payload.fields), 2 * SAVE_TIMEOUT_MS);
  } catch (err) {
    if (!isDuplicateKey(err)) throw err; // ya había llegado
  }
}

async function replayVisit(op, db) {
  const { fields, citaId, can } = op.payload;
  let saved;
  try {
    saved = await withTimeout(db.addVisit(fields), 2 * SAVE_TIMEOUT_MS);
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    // Ya había llegado: se lee para poder cerrar el ciclo (si no se puede leer, ya llegó y no hay más que hacer).
    saved = await withTimeout(db.getVisitById(fields.id), 2 * SAVE_TIMEOUT_MS).catch(() => null);
    if (!saved) return;
  }
  if (citaId) await closeLoopAfterVisit(db, saved, citaId, can || {});
}

async function replayCita(op, db) {
  try {
    await withTimeout(db.addAgendaCita(op.payload.fields), 2 * SAVE_TIMEOUT_MS);
  } catch (err) {
    if (!isDuplicateKey(err)) throw err; // ya había llegado
  }
}

async function replayContact(op, db, noteSuffix) {
  const { prospectId, channel, nextFollowup, stage } = op.payload;
  const prospect = await withTimeout(db.getProspectById(prospectId), 2 * SAVE_TIMEOUT_MS);
  if (!prospect) throw new Error("El prospecto ya no existe.");
  if (op.maybeSent) {
    const contacts = await withTimeout(db.getProspectContacts(prospectId), 2 * SAVE_TIMEOUT_MS);
    if (contactAlreadyLogged(contacts, op, noteSuffix)) return;
  }
  const fields = contactUpdate(prospect, { nextFollowup, stage, now: new Date(op.createdAt) });
  await withTimeout(db.logProspectContact(prospectId, fields, { channel, note: contactNote(op, noteSuffix) }), 2 * SAVE_TIMEOUT_MS);
}

async function withLock(fn) {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return fn();
  return locks.request("acl-offline-flush", { ifAvailable: true }, (lock) => (lock ? fn() : { sent: 0, failed: 0, stopped: false, skipped: true }));
}

let flushing = null;

/**
 * Envía la cola de `email`, una operación a la vez y en orden. Devuelve { sent, failed, stopped }:
 *   sent    — cuántas se enviaron (ya salieron de la cola);
 *   failed  — cuántas fallaron por algo que no es la red (quedan marcadas, no se reintentan solas);
 *   stopped — se cortó por falta de red: lo que quedaba sigue pendiente.
 * Si ya hay un envío en curso devuelve el mismo (no se manda dos veces lo mismo).
 */
export function flushQueue({ email, db, noteSuffix = defaultNoteSuffix }) {
  if (flushing) return flushing;
  flushing = withLock(async () => {
    const result = { sent: 0, failed: 0, stopped: false };
    for (const op of getQueue(email).filter((o) => !o.failed)) {
      try {
        if (op.type === "prospect.add") await replayProspect(op, db);
        else if (op.type === "visit.add") await replayVisit(op, db);
        else if (op.type === "cita.add") await replayCita(op, db);
        else await replayContact(op, db, noteSuffix);
        removeOp(email, op.id);
        result.sent += 1;
      } catch (err) {
        if (isOfflineError(err)) {
          patchOp(email, op.id, { attempts: (op.attempts || 0) + 1 });
          result.stopped = true;
          break;
        }
        patchOp(email, op.id, { failed: true, attempts: (op.attempts || 0) + 1, lastError: String(err?.message || err).slice(0, 200) });
        result.failed += 1;
      }
    }
    return result;
  }).finally(() => {
    flushing = null;
  });
  return flushing;
}

// Para las pruebas.
export function resetOfflineQueueForTests() {
  cache.clear();
  listeners.clear();
  flushing = null;
}
