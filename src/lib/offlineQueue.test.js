import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_OPS,
  contactAlreadyLogged,
  contactNote,
  enqueue,
  enqueueContact,
  enqueueCita,
  enqueueProspect,
  enqueueVisit,
  flushQueue,
  getQueue,
  isOfflineError,
  removeOp,
  resetOfflineQueueForTests,
  retryOp,
  subscribeQueue,
  withTimeout,
} from "./offlineQueue";

// localStorage de mentira (el entorno de pruebas es node).
const backing = new Map();
let failWrites = false;
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => {
    if (failWrites) throw new Error("QuotaExceededError");
    backing.set(k, String(v));
  },
  removeItem: (k) => backing.delete(k),
};

const ME = "ana@acl.mx";
const prospectFields = (n = 1) => ({ id: `id-${n}`, name: `Prospecto ${n}`, phone: "8715550101", stage: "nuevo", source: "manual" });
const fakeDb = (over = {}) => ({
  addProspect: vi.fn(async (fields) => fields),
  getProspectById: vi.fn(async (id) => ({ id, name: "Luis", stage: "nuevo", next_followup_at: null, last_contact_at: null })),
  getProspectContacts: vi.fn(async () => []),
  logProspectContact: vi.fn(async (id, fields) => ({ id, ...fields })),
  ...over,
});

beforeEach(() => {
  backing.clear();
  failWrites = false;
  resetOfflineQueueForTests();
});
afterEach(() => vi.useRealTimers());

describe("la cola (almacenamiento por cuenta)", () => {
  it("guarda en orden con sus datos por omisión y devuelve el mismo arreglo mientras no cambie", () => {
    expect(enqueueProspect(ME, prospectFields(1))).toBe(true);
    expect(enqueueProspect(ME, prospectFields(2))).toBe(true);
    const ops = getQueue(ME);
    expect(ops.map((o) => o.label)).toEqual(["Prospecto 1", "Prospecto 2"]);
    expect(ops[0]).toMatchObject({ type: "prospect.add", attempts: 0, failed: false, lastError: "" });
    expect(typeof ops[0].id).toBe("string");
    expect(getQueue(ME)).toBe(ops);
  });

  it("cada cuenta tiene la suya: otra no la ve", () => {
    enqueueProspect(ME, prospectFields(1));
    expect(getQueue("otra@acl.mx")).toHaveLength(0);
    expect(getQueue(ME)).toHaveLength(1);
  });

  it("quitar y reintentar", () => {
    enqueueProspect(ME, prospectFields(1));
    const [op] = getQueue(ME);
    expect(removeOp(ME, op.id)).toBe(true);
    expect(getQueue(ME)).toHaveLength(0);
    expect(backing.size).toBe(0); // una cola vacía no deja rastro
  });

  it("un valor dañado en el almacenamiento no rompe nada y se ignora lo que no es una operación", () => {
    backing.set(`acl_offline_queue_v1:${ME}`, "{no es json");
    expect(getQueue(ME)).toHaveLength(0);
    backing.set(`acl_offline_queue_v1:${ME}`, JSON.stringify([{ id: "x", type: "otra-cosa", payload: {} }, null, 5, { id: "ok", type: "prospect.add", payload: { fields: {} } }]));
    expect(getQueue(ME).map((o) => o.id)).toEqual(["ok"]);
  });

  it("avisa que no pudo guardar: sin cuenta, tipo desconocido, cola llena o sin espacio", () => {
    expect(enqueueProspect("", prospectFields())).toBe(false);
    expect(enqueue(ME, { type: "otra", payload: {} })).toBe(false);
    for (let i = 0; i < MAX_OPS; i++) expect(enqueueProspect(ME, prospectFields(i))).toBe(true);
    expect(enqueueProspect(ME, prospectFields(999))).toBe(false);
    backing.clear();
    resetOfflineQueueForTests();
    failWrites = true;
    expect(enqueueProspect(ME, prospectFields())).toBe(false);
    expect(getQueue(ME)).toHaveLength(0);
  });

  it("avisa a quien lo está mostrando al cambiar", () => {
    const seen = vi.fn();
    const off = subscribeQueue(seen);
    enqueueProspect(ME, prospectFields());
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    enqueueProspect(ME, prospectFields(2));
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("isOfflineError y withTimeout", () => {
  it("sin conexión todo es un fallo de red", () => {
    expect(isOfflineError(new Error("lo que sea"), false)).toBe(true);
  });

  it("reconoce los mensajes de red de los navegadores y de Supabase, y no confunde otros errores", () => {
    for (const message of ["Failed to fetch", "TypeError: Failed to fetch", "NetworkError when attempting to fetch resource.", "Network request failed", "Load failed", "fetch failed"]) {
      expect(isOfflineError(new Error(message), true), message).toBe(true);
    }
    expect(isOfflineError({ message: 'new row violates row-level security policy for table "prospectos"', code: "42501" }, true)).toBe(false);
    expect(isOfflineError(new Error("Escribe el nombre."), true)).toBe(false);
  });

  it("el tiempo agotado cuenta como sin señal", async () => {
    vi.useFakeTimers();
    const slow = withTimeout(new Promise(() => {}), 1000);
    const caught = slow.catch((e) => e);
    await vi.advanceTimersByTimeAsync(1001);
    const err = await caught;
    expect(err.name).toBe("OfflineTimeout");
    expect(isOfflineError(err, true)).toBe(true);
  });

  it("si responde a tiempo devuelve lo suyo y no deja el temporizador", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("flushQueue: prospectos", () => {
  it("envía en orden, saca de la cola lo enviado y cuenta", async () => {
    enqueueProspect(ME, prospectFields(1));
    enqueueProspect(ME, prospectFields(2));
    const db = fakeDb();
    const result = await flushQueue({ email: ME, db });
    expect(result).toEqual({ sent: 2, failed: 0, stopped: false });
    expect(db.addProspect.mock.calls.map(([f]) => f.id)).toEqual(["id-1", "id-2"]);
    expect(getQueue(ME)).toHaveLength(0);
  });

  it("un prospecto que ya había llegado (mismo id → clave duplicada) se da por enviado, no se duplica ni se queda atorado", async () => {
    enqueueProspect(ME, prospectFields(1));
    const db = fakeDb({ addProspect: vi.fn(async () => Promise.reject({ code: "23505", message: 'duplicate key value violates unique constraint "prospectos_pkey"' })) });
    expect(await flushQueue({ email: ME, db })).toMatchObject({ sent: 1, failed: 0 });
    expect(getQueue(ME)).toHaveLength(0);
  });

  it("si se cae la red se corta y lo que falta sigue pendiente, en orden", async () => {
    for (let i = 1; i <= 3; i++) enqueueProspect(ME, prospectFields(i));
    let calls = 0;
    const db = fakeDb({
      addProspect: vi.fn(async (f) => {
        calls += 1;
        if (calls === 2) throw new Error("Failed to fetch");
        return f;
      }),
    });
    expect(await flushQueue({ email: ME, db })).toEqual({ sent: 1, failed: 0, stopped: true });
    expect(getQueue(ME).map((o) => o.label)).toEqual(["Prospecto 2", "Prospecto 3"]);
    expect(getQueue(ME)[0].attempts).toBe(1);
    expect(getQueue(ME)[0].failed).toBe(false);
    // Vuelve la red: sale lo que faltaba.
    expect(await flushQueue({ email: ME, db: fakeDb() })).toMatchObject({ sent: 2, stopped: false });
  });

  it("un error que no es de red (p. ej. permisos) deja esa operación marcada, sigue con las demás y no se reintenta sola", async () => {
    for (let i = 1; i <= 3; i++) enqueueProspect(ME, prospectFields(i));
    const db = fakeDb({
      addProspect: vi.fn(async (f) => {
        if (f.id === "id-2") throw { code: "42501", message: "new row violates row-level security policy" };
        return f;
      }),
    });
    expect(await flushQueue({ email: ME, db })).toEqual({ sent: 2, failed: 1, stopped: false });
    const [left] = getQueue(ME);
    expect(left).toMatchObject({ label: "Prospecto 2", failed: true });
    expect(left.lastError).toContain("row-level security");

    // Otro envío la salta (no se reintenta sola)...
    const again = fakeDb();
    expect(await flushQueue({ email: ME, db: again })).toEqual({ sent: 0, failed: 0, stopped: false });
    expect(again.addProspect).not.toHaveBeenCalled();
    // ...hasta que el asesor decide reintentar.
    retryOp(ME, left.id);
    expect(await flushQueue({ email: ME, db: again })).toMatchObject({ sent: 1 });
    expect(getQueue(ME)).toHaveLength(0);
  });

  it("dos envíos a la vez comparten uno solo (no se manda dos veces lo mismo)", async () => {
    enqueueProspect(ME, prospectFields(1));
    const db = fakeDb();
    const [a, b] = await Promise.all([flushQueue({ email: ME, db }), flushQueue({ email: ME, db })]);
    expect(db.addProspect).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });
});

describe("flushQueue: contactos", () => {
  const registered = new Date(2026, 10, 12, 10, 30).toISOString();
  const queueContact = (over = {}) => {
    enqueueContact(ME, { prospect: { id: "p1", name: "Luis", stage: "nuevo" }, channel: "llamada", note: "No contestó", nextFollowup: "2026-11-13", ...over });
    const [op] = getQueue(ME);
    // Se registró «hace un rato»: fija su hora para controlar el retraso.
    const raw = JSON.parse(backing.get(`acl_offline_queue_v1:${ME}`));
    raw[0].createdAt = over.createdAt ?? registered;
    backing.set(`acl_offline_queue_v1:${ME}`, JSON.stringify(raw));
    return op;
  };

  it("recalcula con el prospecto de AHORA: «nuevo» pasa a «contactado», con la hora real del contacto", async () => {
    queueContact({ createdAt: new Date().toISOString() });
    const db = fakeDb();
    await flushQueue({ email: ME, db });
    const [id, fields, meta] = db.logProspectContact.mock.calls[0];
    expect(id).toBe("p1");
    expect(fields).toMatchObject({ stage: "contactado", next_followup_at: "2026-11-13" });
    expect(meta).toEqual({ channel: "llamada", note: "No contestó" });
  });

  it("no hace retroceder de etapa a quien un compañero ya movió mientras no había señal", async () => {
    queueContact({ createdAt: new Date().toISOString() });
    const db = fakeDb({ getProspectById: vi.fn(async (id) => ({ id, stage: "negociacion", next_followup_at: null })) });
    await flushQueue({ email: ME, db });
    expect(db.logProspectContact.mock.calls[0][1]).not.toHaveProperty("stage");
  });

  it("un resultado «Interesado» sigue avanzando la etapa al enviarse", async () => {
    queueContact({ createdAt: new Date().toISOString(), stage: "interesado", nextFollowup: "2026-11-15" });
    const db = fakeDb();
    await flushQueue({ email: ME, db });
    expect(db.logProspectContact.mock.calls[0][1].stage).toBe("interesado");
  });

  it("el último contacto lleva la hora en que se registró, no la de envío", async () => {
    queueContact();
    const db = fakeDb();
    await flushQueue({ email: ME, db });
    expect(db.logProspectContact.mock.calls[0][1].last_contact_at).toBe(registered);
  });

  it("enviado con retraso, la nota lleva anotada la hora real; reciente, no", async () => {
    queueContact(); // registrado hace mucho (2026-11-12 10:30)
    const db = fakeDb();
    await flushQueue({ email: ME, db, noteSuffix: (d) => `(sin conexión ${d.getHours()}:${d.getMinutes()})` });
    expect(db.logProspectContact.mock.calls[0][2].note).toBe("No contestó (sin conexión 10:30)");
    expect(contactNote({ createdAt: new Date().toISOString(), payload: { note: "Hola" } })).toBe("Hola");
    expect(contactNote({ createdAt: registered, payload: { note: "" } }, (d) => "(tarde)")).toBe("(tarde)");
  });

  it("un contacto dudoso (la petición pudo haber llegado) no se repite si el historial ya lo trae", async () => {
    queueContact({ maybeSent: true, createdAt: new Date().toISOString() });
    const db = fakeDb({ getProspectContacts: vi.fn(async () => [{ channel: "llamada", note: "No contestó", at: new Date().toISOString() }]) });
    expect(await flushQueue({ email: ME, db })).toMatchObject({ sent: 1 });
    expect(db.logProspectContact).not.toHaveBeenCalled();
  });

  it("pero si el historial no lo trae (o es otro canal u otra nota), sí se registra", async () => {
    queueContact({ maybeSent: true, createdAt: new Date().toISOString() });
    const db = fakeDb({ getProspectContacts: vi.fn(async () => [{ channel: "whatsapp", note: "No contestó", at: new Date().toISOString() }, { channel: "llamada", note: "Otra cosa", at: new Date().toISOString() }]) });
    await flushQueue({ email: ME, db });
    expect(db.logProspectContact).toHaveBeenCalledTimes(1);
  });

  it("un contacto con la misma nota pero de hace mucho (antes de éste) no cuenta como ya enviado", () => {
    const op = { createdAt: new Date().toISOString(), payload: { channel: "llamada", note: "No contestó" } };
    const old = new Date(Date.now() - 3600e3).toISOString();
    expect(contactAlreadyLogged([{ channel: "llamada", note: "No contestó", at: old }], op)).toBe(false);
    expect(contactAlreadyLogged([{ channel: "llamada", note: "No contestó", at: new Date().toISOString() }], op)).toBe(true);
  });

  it("si el prospecto ya no existe, queda marcada con el motivo y no atora a las demás", async () => {
    queueContact({ createdAt: new Date().toISOString() });
    enqueueProspect(ME, prospectFields(5));
    const db = fakeDb({ getProspectById: vi.fn(async () => null) });
    expect(await flushQueue({ email: ME, db })).toEqual({ sent: 1, failed: 1, stopped: false });
    const [left] = getQueue(ME);
    expect(left).toMatchObject({ type: "prospect.contact", failed: true });
    expect(left.lastError).toBe("El prospecto ya no existe.");
  });
});

describe("flushQueue: visitas y citas", () => {
  const visitFields = (n = 1) => ({ id: `v-${n}`, property_id: "prop-1", advisor_id: "advisor-1", visited_at: "2026-11-13T10:00:00.000Z", prospect_name: `Cliente ${n}`, interest: "muy_interesado", reasons: [], comments: null });
  const citaFields = (n = 1) => ({ id: `c-${n}`, advisor_id: "advisor-1", client_id: "", titulo: `Visita ${n}`, fecha: "2026-11-14", hora: "11:00" });
  const duplicate = () => Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  const vdb = (over = {}) => ({
    addVisit: vi.fn(async (f) => f),
    getVisitById: vi.fn(async (id) => ({ id, property_id: "prop-1", interest: "muy_interesado" })),
    addAgendaCita: vi.fn(async (f) => f),
    getAgendaCitaById: vi.fn(async (id) => ({ id, status: "confirmada", prospecto_id: "p1" })),
    setAgendaCitaStatus: vi.fn(async () => ({})),
    getProspects: vi.fn(async () => [{ id: "p1", name: "Luis", stage: "contactado", advisor_id: "advisor-1" }]),
    updateProspect: vi.fn(async () => ({})),
    ...over,
  });

  it("se guardan con su etiqueta y su id, y salen en orden junto con lo demás", async () => {
    expect(enqueueVisit(ME, { fields: visitFields(1), label: "Cliente 1" })).toBe(true);
    expect(enqueueCita(ME, { fields: citaFields(1), label: "Visita 1" })).toBe(true);
    enqueueProspect(ME, prospectFields(1));
    expect(getQueue(ME).map((o) => [o.type, o.label])).toEqual([["visit.add", "Cliente 1"], ["cita.add", "Visita 1"], ["prospect.add", "Prospecto 1"]]);
    const db = vdb({ addProspect: vi.fn(async (f) => f) });
    const out = await flushQueue({ email: ME, db });
    expect(out).toEqual({ sent: 3, failed: 0, stopped: false });
    expect(db.addVisit).toHaveBeenCalledWith(expect.objectContaining({ id: "v-1" }));
    expect(db.addAgendaCita).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1" }));
    expect(getQueue(ME)).toEqual([]);
  });

  it("una visita que salió de una cita cierra el ciclo al enviarse (cita realizada y prospecto al día); una suelta no toca nada", async () => {
    enqueueVisit(ME, { fields: visitFields(1), label: "A", citaId: "cita-9", can: { agenda: true, prospectos: true } });
    enqueueVisit(ME, { fields: visitFields(2), label: "B" });
    const db = vdb();
    await flushQueue({ email: ME, db });
    expect(db.getAgendaCitaById).toHaveBeenCalledTimes(1);
    expect(db.getAgendaCitaById).toHaveBeenCalledWith("cita-9");
    expect(db.setAgendaCitaStatus).toHaveBeenCalledWith("cita-9", "realizada");
    expect(db.updateProspect).toHaveBeenCalledWith("p1", expect.any(Object));
  });

  it("sin el apartado Agenda no se cierra la cita (lo que tenía el rol al registrarla)", async () => {
    enqueueVisit(ME, { fields: visitFields(1), label: "A", citaId: "cita-9", can: { agenda: false, prospectos: false } });
    const db = vdb();
    await flushQueue({ email: ME, db });
    expect(db.setAgendaCitaStatus).not.toHaveBeenCalled();
    expect(db.updateProspect).not.toHaveBeenCalled();
  });

  it("una visita que ya había llegado (mismo id) no se duplica, pero igual cierra el ciclo de su cita", async () => {
    enqueueVisit(ME, { fields: visitFields(1), label: "A", citaId: "cita-9", can: { agenda: true } });
    const db = vdb({ addVisit: vi.fn(async () => Promise.reject(duplicate())) });
    const out = await flushQueue({ email: ME, db });
    expect(out).toEqual({ sent: 1, failed: 0, stopped: false });
    expect(db.getVisitById).toHaveBeenCalledWith("v-1");
    expect(db.setAgendaCitaStatus).toHaveBeenCalledWith("cita-9", "realizada");
  });

  it("una visita duplicada que ya no se puede leer se da por enviada", async () => {
    enqueueVisit(ME, { fields: visitFields(1), label: "A", citaId: "cita-9", can: { agenda: true } });
    const db = vdb({ addVisit: vi.fn(async () => Promise.reject(duplicate())), getVisitById: vi.fn(async () => Promise.reject(new Error("permiso"))) });
    expect(await flushQueue({ email: ME, db })).toEqual({ sent: 1, failed: 0, stopped: false });
    expect(db.setAgendaCitaStatus).not.toHaveBeenCalled();
  });

  it("una cita que ya había llegado se da por enviada, no se duplica ni se queda atorada", async () => {
    enqueueCita(ME, { fields: citaFields(1), label: "Visita 1" });
    const db = vdb({ addAgendaCita: vi.fn(async () => Promise.reject(duplicate())) });
    expect(await flushQueue({ email: ME, db })).toEqual({ sent: 1, failed: 0, stopped: false });
    expect(getQueue(ME)).toEqual([]);
  });

  it("si se cae la red a media cola se corta y lo demás sigue pendiente, en orden", async () => {
    enqueueCita(ME, { fields: citaFields(1), label: "Visita 1" });
    enqueueVisit(ME, { fields: visitFields(1), label: "A" });
    const db = vdb({ addAgendaCita: vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))) });
    expect(await flushQueue({ email: ME, db })).toEqual({ sent: 0, failed: 0, stopped: true });
    expect(db.addVisit).not.toHaveBeenCalled();
    expect(getQueue(ME).map((o) => [o.type, o.attempts])).toEqual([["cita.add", 1], ["visit.add", 0]]);
  });

  it("un error que no es de red (p. ej. permisos) marca esa visita, y las demás siguen", async () => {
    enqueueVisit(ME, { fields: visitFields(1), label: "A" });
    enqueueCita(ME, { fields: citaFields(1), label: "Visita 1" });
    const db = vdb({ addVisit: vi.fn(async () => Promise.reject(new Error("new row violates row-level security policy"))) });
    expect(await flushQueue({ email: ME, db })).toEqual({ sent: 1, failed: 1, stopped: false });
    const [left] = getQueue(ME);
    expect(left).toMatchObject({ type: "visit.add", failed: true });
    expect(left.lastError).toContain("row-level security");
  });
});
