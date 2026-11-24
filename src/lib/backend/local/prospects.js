// Backend de modo demo (localStorage): métodos de «prospects» (29). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { ADVISORS, PROPERTIES, VENTAS_SEED, VISITS_SEED, DEMO_ADMIN } from "../../seedData";
import { getOrCreateVisitorId } from "../../visitorId";
import { findDuplicates } from "../../duplicates";
import { syncProspectFollowup } from "../../visitProspect";
import { SELECTION_VALID_DAYS, cleanReaction, cleanSelectionInput } from "../../selections";
import { canMerge, mergedProspectFields } from "../../mergeProspects";
import { computeLeaderboardRows } from "../../leaderboard";
import { generateBookingToken, mexicoParts } from "../../visitSlots";
import { KEYS, readStore, writeStore, uid } from "./shared.js";

export const prospectsMethods = {
  // Fusiona dos prospectos (espejo de merge_prospects): lo que pasa al conservado lo decide lib/mergeProspects.js.
  async mergeProspects(keepId, removeId) {
    const prospects = readStore(KEYS.prospects, []);
    const keep = prospects.find((p) => p.id === keepId);
    const remove = prospects.find((p) => p.id === removeId);
    if (keepId === removeId) throw new Error("merge:invalid");
    if (!keep || !remove) throw new Error("merge:not_found");
    if (!canMerge(keep, remove, null)) throw new Error("merge:forbidden");
    writeStore(KEYS.prospects, prospects.filter((p) => p.id !== removeId).map((p) => (p.id === keepId ? { ...p, ...mergedProspectFields(keep, remove) } : p)));
    const moveProspecto = (key) => writeStore(KEYS[key], readStore(KEYS[key], []).map((row) => (row.prospecto_id === removeId ? { ...row, prospecto_id: keepId } : row)));
    moveProspecto("prospectStages");
    moveProspecto("prospectContacts");
    moveProspecto("agendaCitas");
    moveProspecto("selections");
    writeStore(
      KEYS.internalNotes,
      readStore(KEYS.internalNotes, []).map((n) => (n.entity_type === "prospect" && n.entity_id === removeId ? { ...n, entity_id: keepId } : n))
    );
    return { ok: true, kept: keepId };
  },

  // Prospectos por etapas (modo demo: localStorage, sin RLS).
  async getProspects() {
    return readStore(KEYS.prospects, []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async getProspectById(id) {
    return readStore(KEYS.prospects, []).find((p) => p.id === id) || null;
  },

  // Alertas de propiedades (modo demo): mismas reglas que alert_subscribe en la base.
  async subscribeAlert({ kind, name, phone, contactMethod, email, criteria, propertyId }) {
    if (!["search", "price"].includes(kind)) return { error: "bad_kind" };
    const method = contactMethod === "email" ? "email" : "whatsapp";
    if (!String(name || "").trim() || String(name).length > 80) return { error: "name_required" };

    let normalized = null;
    let normalizedEmail = null;
    if (method === "whatsapp") {
      const digits = String(phone || "").replace(/\D/g, "");
      if (digits.length === 10) normalized = `52${digits}`;
      else if (digits.length === 12 && digits.startsWith("52")) normalized = digits;
      else if (digits.length === 13 && digits.startsWith("521")) normalized = `52${digits.slice(3)}`;
      else return { error: "bad_phone" };
    } else {
      normalizedEmail = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 180) return { error: "bad_email" };
    }
    const crit = criteria && typeof criteria === "object" && !Array.isArray(criteria) ? criteria : null;
    if (!crit || JSON.stringify(crit).length > 1500) return { error: "bad_criteria" };

    let property = null;
    if (kind === "price") {
      property = await this.getPropertyById(propertyId);
      if (!property || property.active === false || property.status !== "disponible") return { error: "property_unavailable" };
    }
    const items = readStore(KEYS.alerts, []);
    const sameContact = (a) => (method === "whatsapp" ? a.phone === normalized : a.email === normalizedEmail);
    const same = (a) => a.active && a.contact_method === method && sameContact(a) && a.kind === kind && (kind === "price" ? a.property_id === propertyId : JSON.stringify(a.criteria) === JSON.stringify(crit));
    if (items.some(same)) return { ok: true, duplicate: true };
    if (items.filter((a) => a.active && a.contact_method === method && sameContact(a)).length >= 5) return { error: "limit" };
    items.push({
      id: uid("alert"),
      kind,
      name: String(name).trim(),
      phone: normalized,
      email: normalizedEmail,
      contact_method: method,
      criteria: kind === "price" ? {} : crit,
      property_id: kind === "price" ? propertyId : null,
      price_at_subscribe: kind === "price" ? Number(property.price) : null,
      active: true,
      unsubscribe_token: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""),
      created_at: new Date().toISOString(),
      last_notified_at: null,
    });
    writeStore(KEYS.alerts, items);
    return { ok: true };
  },

  async unsubscribeAlert(token) {
    const items = readStore(KEYS.alerts, []);
    const idx = items.findIndex((a) => a.unsubscribe_token === token);
    if (idx === -1) return { error: "not_found" };
    items[idx] = { ...items[idx], active: false };
    writeStore(KEYS.alerts, items);
    return { ok: true };
  },

  async getAlerts() {
    return readStore(KEYS.alerts, [])
      .map(({ unsubscribe_token, ...rest }) => rest)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async setAlertActive(id, active) {
    writeStore(KEYS.alerts, readStore(KEYS.alerts, []).map((a) => (a.id === id ? { ...a, active } : a)));
  },

  async deleteAlert(id) {
    writeStore(KEYS.alerts, readStore(KEYS.alerts, []).filter((a) => a.id !== id));
  },

  // Historial de etapas (modo demo): lo que en Supabase hace un trigger.
  _logProspectStage(prospectId, stage, at = new Date().toISOString()) {
    const stages = readStore(KEYS.prospectStages, []);
    stages.push({ prospecto_id: prospectId, stage, at });
    writeStore(KEYS.prospectStages, stages);
  },

  // Los prospectos anteriores al historial reciben una fila con su etapa actual.
  async getProspectStageHistory() {
    const stages = readStore(KEYS.prospectStages, []);
    const seen = new Set(stages.map((s) => s.prospecto_id));
    const backfill = readStore(KEYS.prospects, [])
      .filter((p) => !seen.has(p.id))
      .map((p) => ({ prospecto_id: p.id, stage: p.stage, at: p.stage === "nuevo" ? p.created_at : p.updated_at }));
    return [...stages, ...backfill].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  },

  async findContactDuplicates({ phone, email, excludeProspectId }) {
    return findDuplicates(
      { phone, email },
      {
        prospects: readStore(KEYS.prospects, []),
        clients: readStore(KEYS.clients, []),
        advisors: readStore(KEYS.advisors, ADVISORS),
        excludeProspectId,
      }
    );
  },

  async addProspect(fields) {
    const items = readStore(KEYS.prospects, []);
    const now = new Date().toISOString();
    const record = { id: uid("prospect"), ...fields, created_by: DEMO_ADMIN.email, created_at: now, updated_at: now };
    items.push(record);
    writeStore(KEYS.prospects, items);
    this._logProspectStage(record.id, record.stage, now);
    return record;
  },

  async addProspects(rows) {
    const items = readStore(KEYS.prospects, []);
    const now = new Date().toISOString();
    const records = rows.map((r) => ({ id: uid("prospect"), ...r, created_by: DEMO_ADMIN.email, created_at: now, updated_at: now }));
    writeStore(KEYS.prospects, [...items, ...records]);
    records.forEach((r) => this._logProspectStage(r.id, r.stage, now));
    return records;
  },

  async updateProspect(id, fields) {
    const items = readStore(KEYS.prospects, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Prospecto no encontrado");
    const previousStage = items[idx].stage;
    items[idx] = { ...items[idx], ...fields, updated_at: new Date().toISOString() };
    writeStore(KEYS.prospects, items);
    if (fields.stage && fields.stage !== previousStage) this._logProspectStage(id, fields.stage);
    return items[idx];
  },

  async deleteProspect(id) {
    writeStore(KEYS.prospects, readStore(KEYS.prospects, []).filter((p) => p.id !== id));
    writeStore(KEYS.prospectStages, readStore(KEYS.prospectStages, []).filter((s) => s.prospecto_id !== id));
    writeStore(KEYS.prospectContacts, readStore(KEYS.prospectContacts, []).filter((c) => c.prospecto_id !== id));
  },

  // Selección de propiedades en un solo enlace (espejo de property_selections y selection_open de schema.sql).
  async createSelection({ propertyIds, title, note, advisorId = null, prospectoId = null }) {
    const clean = cleanSelectionInput({ propertyIds, title, note });
    if (clean.property_ids.length === 0) throw new Error("Elige al menos una propiedad");
    const now = new Date();
    const record = {
      id: uid("selection"),
      token: generateBookingToken(),
      ...clean,
      advisor_id: advisorId,
      prospecto_id: prospectoId,
      created_by: DEMO_ADMIN.email,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + SELECTION_VALID_DAYS * 864e5).toISOString(),
      first_opened_at: null,
      last_opened_at: null,
      open_count: 0,
      revoked_at: null,
    };
    writeStore(KEYS.selections, [record, ...readStore(KEYS.selections, [])]);
    return record;
  },

  async getSelections() {
    return [...readStore(KEYS.selections, [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async revokeSelection(id) {
    const items = readStore(KEYS.selections, []);
    const idx = items.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Selección no encontrada");
    items[idx] = { ...items[idx], revoked_at: new Date().toISOString() };
    writeStore(KEYS.selections, items);
    return items[idx];
  },

  // Espejo de selection_advisor (migración 0118): el asesor de la selección, para quien tiene el enlace — también si ya
  // venció o se retiró, para que el cliente sepa a quién escribirle.
  async getSelectionAdvisor(token) {
    const found = readStore(KEYS.selections, []).find((s) => s.token === token);
    if (!found?.advisor_id) return null;
    const advisor = readStore(KEYS.advisors, ADVISORS).find((a) => a.id === found.advisor_id);
    if (!advisor || advisor.active === false) return null;
    return { id: advisor.id, name: advisor.name, photo_url: advisor.photo_url, phone: advisor.phone, whatsapp: advisor.whatsapp };
  },

  // Lo que consulta la página pública: null si el token no existe; si no, { status: ok | expired | revoked, … }. Con
  // `track` (por omisión) anota la apertura; el asesor que previsualiza pasa track: false.
  async openSelection(token, { track = true } = {}) {
    const items = readStore(KEYS.selections, []);
    const idx = items.findIndex((s) => s.token === token);
    if (idx === -1) return null;
    const found = items[idx];
    const status = found.revoked_at ? "revoked" : new Date(found.expires_at).getTime() < Date.now() ? "expired" : "ok";
    if (status === "ok" && track) {
      const now = new Date().toISOString();
      items[idx] = { ...found, open_count: (found.open_count || 0) + 1, first_opened_at: found.first_opened_at || now, last_opened_at: now };
      writeStore(KEYS.selections, items);
    }
    return {
      status,
      title: found.title,
      note: found.note,
      advisor_id: found.advisor_id,
      property_ids: status === "ok" ? found.property_ids : [],
      created_at: found.created_at,
      expires_at: found.expires_at,
      reactions: status === "ok" ? found.reactions || {} : {},
    };
  },

  // Espejo de selection_react (schema.sql): mismas validaciones y mismos errores.
  async reactToSelection(token, propertyId, { reaction = null, comment = null } = {}) {
    const items = readStore(KEYS.selections, []);
    const idx = items.findIndex((s) => s.token === token);
    if (idx === -1) return { error: "unavailable" };
    const found = items[idx];
    if (found.revoked_at || new Date(found.expires_at).getTime() < Date.now()) return { error: "unavailable" };
    if (!(found.property_ids || []).includes(propertyId)) return { error: "invalid_property" };
    const cleaned = cleanReaction({ reaction, comment });
    if (cleaned.error) return { error: cleaned.error };
    const reactions = { ...(found.reactions || {}) };
    if (cleaned.reaction == null && cleaned.comment == null) delete reactions[propertyId];
    else reactions[propertyId] = { r: cleaned.reaction, c: cleaned.comment, at: new Date().toISOString() };
    items[idx] = { ...found, reactions };
    writeStore(KEYS.selections, items);
    return { ok: true, reactions };
  },

  // Espejo de track_property_event: una vez por visitante, evento y día, solo en propiedades publicadas.
  async trackPropertyEvent(propertyId, kind) {
    if (!["favorite", "share"].includes(kind)) return;
    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === propertyId);
    if (!property || !property.active) return;
    const visitorId = getOrCreateVisitorId();
    const today = new Date().toISOString().slice(0, 10);
    const events = readStore(KEYS.propertyEvents, []);
    if (events.some((e) => e.property_id === propertyId && e.visitor_id === visitorId && e.kind === kind && e.event_on === today)) return;
    events.push({ property_id: propertyId, visitor_id: visitorId, kind, event_on: today });
    writeStore(KEYS.propertyEvents, events);
  },

  // Historial de contactos (modo demo: localStorage).
  // Espejo de getProspectContactLog de Supabase.
  async getProspectContactLog(days = 45) {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    return readStore(KEYS.prospectContacts, []).filter((c) => String(c.at) >= since).map((c) => ({ prospecto_id: c.prospecto_id, at: c.at }));
  },

  async getProspectContacts(prospectId) {
    return readStore(KEYS.prospectContacts, [])
      .filter((c) => c.prospecto_id === prospectId)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },

  async countProspectContactsSince(sinceISO) {
    return readStore(KEYS.prospectContacts, []).filter((c) => String(c.at) >= sinceISO).length;
  },

  async getTeamLeaderboard() {
    return computeLeaderboardRows({
      advisors: readStore(KEYS.advisors, ADVISORS),
      prospects: readStore(KEYS.prospects, []),
      contacts: readStore(KEYS.prospectContacts, []),
      visits: readStore(KEYS.visits, VISITS_SEED),
      ventas: readStore(KEYS.ventas, VENTAS_SEED),
      goals: readStore(KEYS.advisorGoals, {}),
    });
  },

  async getAdvisorGoals(advisorId) {
    return readStore(KEYS.advisorGoals, {})[advisorId] || null;
  },

  async saveAdvisorGoals(advisorId, columns) {
    const all = readStore(KEYS.advisorGoals, {});
    all[advisorId] = { advisor_id: advisorId, ...columns, updated_at: new Date().toISOString() };
    writeStore(KEYS.advisorGoals, all);
    return all[advisorId];
  },

  async logProspectContact(prospectId, fields, { channel, note }) {
    const updated = await this.updateProspect(prospectId, fields);
    const text = String(note ?? "").trim();
    const contacts = readStore(KEYS.prospectContacts, []);
    contacts.push({ id: uid("contact"), prospecto_id: prospectId, channel, note: text === "" ? null : text, at: new Date().toISOString(), actor: DEMO_ADMIN.email });
    writeStore(KEYS.prospectContacts, contacts);
    return updated;
  },

  // Mantiene al día el seguimiento del prospecto cuando la cita cambia (como trg_agenda_citas_sync_prospect):
  // si se mueve, el seguimiento automático se mueve; si se cancela o no asiste, se recontacta mañana.
  async _syncCitaProspect(before, after) {
    if (!after?.prospecto_id || after.source !== "sitio") return;
    const prospect = readStore(KEYS.prospects, []).find((p) => p.id === after.prospecto_id);
    if (!prospect) return;
    const today = mexicoParts().date;
    const was = before.status || "confirmada";
    const now = after.status || "confirmada";
    let fields = null;
    if (now === "confirmada" && after.fecha !== before.fecha) fields = syncProspectFollowup(prospect, { kind: "moved", oldFecha: before.fecha, fecha: after.fecha, today });
    else if ((was === "confirmada" || was === "solicitada") && (now === "cancelada" || now === "no_asistio")) fields = syncProspectFollowup(prospect, { kind: "lost", fecha: after.fecha, today });
    if (fields) await this.updateProspect(prospect.id, fields);
  },
};
