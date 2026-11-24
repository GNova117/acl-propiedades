// Backend de modo demo (localStorage): métodos de «clients» (33). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { DEMO_ADMIN } from "../../seedData";
import { generateIntakeToken, intakeExpiry, intakeState, INTAKE_TOKEN_PATTERN, validateIntake, intakePayload } from "../../clientIntake";
import { generatePortalToken, isExtractedDocType, PORTAL_TOKEN_PATTERN, PORTAL_TOKEN_TTL_DAYS } from "../../clientPortal";
import { PERFILAMIENTO_VENDEDOR_LIST_FIELDS } from "../../perfilamientoVendedor";
import { PERFILAMIENTO_COMPRADOR_LIST_FIELDS } from "../../perfilamientoComprador";
import { clientExpedientePayload, KEYS, readStore, writeStore, uid, fileToDataUrl } from "./shared.js";

export const clientsMethods = {
  async getClients(filters = {}) {
    const clients = readStore(KEYS.clients, []);
    return clients
      .filter((c) => !filters.type || c.type === filters.type)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getClientById(id) {
    const clients = readStore(KEYS.clients, []);
    return clients.find((c) => c.id === id) || null;
  },

  async addClient(data) {
    const clients = readStore(KEYS.clients, []);
    const record = {
      id: uid("client"),
      name: data.name,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      active: data.active !== false,
      financiamiento: data.financiamiento || null,
      ...clientExpedientePayload(data),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    clients.push(record);
    writeStore(KEYS.clients, clients);
    return record;
  },

  async updateClient(id, data) {
    const clients = readStore(KEYS.clients, []);
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Cliente no encontrado");
    const updated = {
      ...clients[idx],
      name: data.name,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      active: data.active !== false,
      financiamiento: data.financiamiento || null,
      ...clientExpedientePayload(data),
      updated_at: new Date().toISOString(),
    };
    clients[idx] = updated;
    writeStore(KEYS.clients, clients);
    return updated;
  },

  async deleteClient(id) {
    const clients = readStore(KEYS.clients, []);
    writeStore(KEYS.clients, clients.filter((c) => c.id !== id));
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(KEYS.clientDocuments, docs.filter((d) => d.client_id !== id));
    writeStore(KEYS.clientPortalTokens, readStore(KEYS.clientPortalTokens, []).filter((t) => t.client_id !== id));
    writeStore(KEYS.clientTramites, readStore(KEYS.clientTramites, []).filter((t) => t.client_id !== id));
  },

  async getClientDocuments(clientId) {
    const docs = readStore(KEYS.clientDocuments, []);
    return docs
      .filter((d) => d.client_id === clientId)
      .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
      .map((d) => ({
        source: "admin_capture",
        file_kind: "document",
        extracted_data: {},
        qr_validated: null,
        review_status: "pendiente",
        review_notes: null,
        client_confirmed: false,
        ...d,
        signed_url: d.file_path,
      }));
  },

  // En demo file_path ya es la data URL completa (no expira, no requiere
  // firmarse) — existe solo para que el llamador no necesite distinguir
  // backend real vs demo antes de descargar/previsualizar un documento.
  async getClientDocumentUrl(doc) {
    return doc.file_path;
  },

  async addClientDocument({ client_id, doc_type, blob, quality_metrics }) {
    const docs = readStore(KEYS.clientDocuments, []);
    const file_path = await fileToDataUrl(blob);
    const record = {
      id: uid("doc"),
      client_id,
      doc_type,
      file_path,
      quality_metrics: quality_metrics || {},
      captured_at: new Date().toISOString(),
    };
    docs.push(record);
    writeStore(KEYS.clientDocuments, docs);
    return record;
  },

  async deleteClientDocument(id) {
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(KEYS.clientDocuments, docs.filter((d) => d.id !== id));
  },

  async getClientLink(clientId) {
    const links = readStore(KEYS.clientLinks, []);
    const link = links.find((l) => l.client_a_id === clientId || l.client_b_id === clientId);
    if (!link) return null;
    const otherId = link.client_a_id === clientId ? link.client_b_id : link.client_a_id;
    const other = await this.getClientById(otherId);
    return { ...link, other_client: other };
  },

  // Todos los vínculos, sin filtrar por cliente — para la pantalla de
  // selección del PDF masivo (AdminClients.jsx), que necesita saber de una
  // vez quién está vinculado con quién para marcar la pareja automático.
  async getAllClientLinks() {
    return readStore(KEYS.clientLinks, []);
  },

  async linkClients(clientAId, clientBId, label) {
    const links = readStore(KEYS.clientLinks, []);
    const record = { id: uid("link"), client_a_id: clientAId, client_b_id: clientBId, label: label || null, created_at: new Date().toISOString() };
    links.push(record);
    writeStore(KEYS.clientLinks, links);
    return record;
  },

  async unlinkClients(linkId) {
    const links = readStore(KEYS.clientLinks, []);
    writeStore(KEYS.clientLinks, links.filter((l) => l.id !== linkId));
  },

  // ── Portal de documentos para clientes — modo demo ──
  async getClientPortalToken(clientId) {
    return readStore(KEYS.clientPortalTokens, []).find((t) => t.client_id === clientId) || null;
  },

  async saveClientPortalToken(clientId) {
    const tokens = readStore(KEYS.clientPortalTokens, []).filter((t) => t.client_id !== clientId);
    const record = {
      id: uid("portaltoken"),
      client_id: clientId,
      token: generatePortalToken(),
      active: true,
      created_by: DEMO_ADMIN.email,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      last_accessed_at: null,
    };
    tokens.push(record);
    writeStore(KEYS.clientPortalTokens, tokens);
    return record;
  },

  async revokeClientPortalToken(clientId) {
    const tokens = readStore(KEYS.clientPortalTokens, []);
    writeStore(
      KEYS.clientPortalTokens,
      tokens.map((t) => (t.client_id === clientId ? { ...t, active: false } : t))
    );
  },

  // ── Enlace para que el cliente mismo capture sus datos — modo demo ──
  async getClientIntakeLinks() {
    const clients = readStore(KEYS.clients, []);
    return readStore(KEYS.clientIntakeLinks, [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50)
      .map((l) => ({ ...l, client_name: clients.find((c) => c.id === l.client_id)?.name || null }));
  },

  async createClientIntakeLink({ type, label, advisorId }) {
    const record = {
      id: uid("intake"),
      token: generateIntakeToken(),
      type,
      label: label?.trim() ? label.trim() : null,
      created_by: DEMO_ADMIN.email,
      advisor_id: advisorId || null,
      created_at: new Date().toISOString(),
      expires_at: intakeExpiry(),
      revoked_at: null,
      seen_at: null,
      submitted_at: null,
      client_id: null,
    };
    writeStore(KEYS.clientIntakeLinks, [...readStore(KEYS.clientIntakeLinks, []), record]);
    return record;
  },

  async revokeClientIntakeLink(id) {
    writeStore(
      KEYS.clientIntakeLinks,
      readStore(KEYS.clientIntakeLinks, []).map((l) => (l.id === id && !l.submitted_at ? { ...l, revoked_at: new Date().toISOString() } : l)),
    );
  },

  async markClientIntakesSeen(ids) {
    if (!ids?.length) return;
    const now = new Date().toISOString();
    writeStore(KEYS.clientIntakeLinks, readStore(KEYS.clientIntakeLinks, []).map((l) => (ids.includes(l.id) && !l.seen_at ? { ...l, seen_at: now } : l)));
  },

  async getClientIntakeStatus(token) {
    if (!INTAKE_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const link = readStore(KEYS.clientIntakeLinks, []).find((l) => l.token === token);
    if (!link) return { status: "invalido" };
    const state = intakeState(link);
    if (state === "pending") return { status: "activo", type: link.type, advisor_id: link.advisor_id || null };
    return { status: { revoked: "revocado", used: "usado", expired: "expirado" }[state] };
  },

  // Mismas reglas que client_intake_submit: el tipo lo pone el enlace y solo se guardan los campos de su lista.
  async submitClientIntake(token, data, consentVersion) {
    const links = readStore(KEYS.clientIntakeLinks, []);
    const link = links.find((l) => l.token === token);
    if (!INTAKE_TOKEN_PATTERN.test(token || "") || !link) return { ok: false, error: "invalido" };
    const state = intakeState(link);
    if (state !== "pending") return { ok: false, error: { revoked: "revocado", used: "usado", expired: "expirado" }[state] };
    const problem = validateIntake(data, { consent: Boolean(consentVersion) });
    if (problem) return { ok: false, error: problem.code };
    const clients = readStore(KEYS.clients, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("client"),
      ...clientExpedientePayload(intakePayload(data, link.type)),
      name: data.name.trim(),
      type: link.type,
      email: data.email?.trim().toLowerCase() || null,
      phone: data.phone.trim(),
      notes: `Datos capturados por el cliente desde el enlace de registro${link.label ? ` («${link.label}»)` : ""}.`,
      active: true,
      financiamiento: null,
      created_at: now,
      updated_at: now,
    };
    writeStore(KEYS.clients, [...clients, record]);
    writeStore(KEYS.clientIntakeLinks, links.map((l) => (l.id === link.id ? { ...l, submitted_at: now, seen_at: null, client_id: record.id } : l)));
    return { ok: true };
  },

  async getClientTramite(clientId) {
    return readStore(KEYS.clientTramites, []).find((t) => t.client_id === clientId) || null;
  },

  async saveClientTramite(clientId, { stage, note, requestedDocs, notifyClient }) {
    const previous = readStore(KEYS.clientTramites, []).find((t) => t.client_id === clientId);
    const record = {
      client_id: clientId,
      stage,
      note: note?.trim() ? note.trim() : null,
      requested_docs: requestedDocs,
      // Igual que en Supabase: solo cambia si viene; si no, conserva lo que había (apagado por omisión).
      notify_client: notifyClient === undefined ? previous?.notify_client ?? false : Boolean(notifyClient),
      updated_by: DEMO_ADMIN.email,
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.clientTramites, [...readStore(KEYS.clientTramites, []).filter((t) => t.client_id !== clientId), record]);
    return record;
  },

  async reviewClientDocument(documentId, clientId, { reviewStatus, reviewNotes }) {
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(
      KEYS.clientDocuments,
      docs.map((d) =>
        d.id === documentId
          ? { ...d, review_status: reviewStatus, review_notes: reviewNotes || null, reviewed_by: DEMO_ADMIN.email, reviewed_at: new Date().toISOString() }
          : d
      )
    );
    const log = readStore(KEYS.documentAccessLog, []);
    log.push({
      id: uid("doclog"),
      client_document_id: documentId,
      client_id: clientId,
      actor_type: "admin",
      actor_ref: DEMO_ADMIN.email,
      action: reviewStatus === "rechazado" ? "reject" : "approve",
      created_at: new Date().toISOString(),
    });
    writeStore(KEYS.documentAccessLog, log);
  },

  // Lado del cliente (sin sesión): en demo no hay token de verdad guardado
  // aparte de localStorage de ESTE navegador, así que solo sirve para
  // probar el flujo completo, no para compartir un enlace real.
  async getPortalStatus(token) {
    if (!PORTAL_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) return { status: "invalido" };
    if (!t.active) return { status: "desactivado" };
    if (new Date(t.expires_at).getTime() < Date.now()) return { status: "expirado" };
    const client = await this.getClientById(t.client_id);
    const allDocs = readStore(KEYS.clientDocuments, [])
      .filter((d) => d.client_id === t.client_id)
      .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
    const tramite = readStore(KEYS.clientTramites, []).find((x) => x.client_id === t.client_id) || null;
    // Misma forma que portal_token_status() en schema.sql: de lo capturado
    // en la oficina solo va el tipo y la fecha.
    return {
      status: "activo",
      client_name: (client?.name || "").split(" ")[0],
      client_type: client?.type || null,
      financiamiento: client?.financiamiento || null,
      tramite: tramite && { stage: tramite.stage, note: tramite.note, requested_docs: tramite.requested_docs, updated_at: tramite.updated_at },
      documents: allDocs.filter((d) => d.source === "client_portal"),
      office_documents: allDocs
        .filter((d) => (d.source || "admin_capture") === "admin_capture")
        .map((d) => ({ doc_type: d.doc_type, captured_at: d.captured_at })),
    };
  },

  async registerPortalConsent(token, consentVersion) {
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) return { error: "not_found" };
    const consents = readStore(KEYS.privacyConsents, []);
    consents.push({ id: uid("consent"), client_id: t.client_id, token_id: t.id, consent_version: consentVersion, accepted_at: new Date().toISOString() });
    writeStore(KEYS.privacyConsents, consents);
    return { ok: true };
  },

  async confirmPortalDocument(token, documentId, extractedData, clientConfirmed) {
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) return { error: "invalid_token" };
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(
      KEYS.clientDocuments,
      docs.map((d) => (d.id === documentId && d.client_id === t.client_id ? { ...d, extracted_data: extractedData, client_confirmed: clientConfirmed } : d))
    );
    return { ok: true };
  },

  // Sin servidor en modo demo: no hay lectura real de texto/QR, solo se
  // guarda el archivo (como data URL, igual que el resto del modo demo) y
  // queda marcado para revisión manual — se avisa en pantalla que es demo.
  async uploadPortalDocument(token, { docType, fileKind, file }) {
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) throw new Error("invalid_token");
    const file_path = await fileToDataUrl(file);
    const record = {
      id: uid("doc"),
      client_id: t.client_id,
      doc_type: docType,
      file_path,
      source: "client_portal",
      file_kind: fileKind,
      quality_metrics: {},
      extracted_data: fileKind === "document" && isExtractedDocType(docType) ? { nota: "Modo demo: sin validación automática (sin servidor)." } : {},
      qr_validated: null,
      review_status: fileKind === "document" && isExtractedDocType(docType) ? "requiere_revision" : "pendiente",
      client_confirmed: false,
      captured_at: new Date().toISOString(),
    };
    const docs = readStore(KEYS.clientDocuments, []);
    docs.push(record);
    writeStore(KEYS.clientDocuments, docs);
    return record;
  },

  // Igual que en Supabase: la lista no incluye RFC/CURP/identificación.
  async getPerfilamientosVendedor(clienteId) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    return items
      .filter((p) => p.cliente_id === clienteId)
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .map((p) => Object.fromEntries(PERFILAMIENTO_VENDEDOR_LIST_FIELDS.map((key) => [key, p[key]])));
  },

  async getPerfilamientoVendedorById(id) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    return items.find((p) => p.id === id) || null;
  },

  async addPerfilamientoVendedor(clienteId, payload) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("perf"),
      cliente_id: clienteId,
      ...payload,
      usuario_creo: DEMO_ADMIN.email,
      fecha_creacion: now,
      fecha_modificacion: now,
    };
    items.push(record);
    writeStore(KEYS.perfilamientosVendedor, items);
    return record;
  },

  async updatePerfilamientoVendedor(id, payload) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Perfilamiento no encontrado");
    const updated = { ...items[idx], ...payload, fecha_modificacion: new Date().toISOString() };
    items[idx] = updated;
    writeStore(KEYS.perfilamientosVendedor, items);
    return updated;
  },

  async deletePerfilamientoVendedor(id) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    writeStore(KEYS.perfilamientosVendedor, items.filter((p) => p.id !== id));
  },

  // Igual que en Supabase: la lista no incluye NSS/CURP/RFC/contraseña de portal.
  async getPerfilamientosComprador(clienteId) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    return items
      .filter((p) => p.cliente_id === clienteId)
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .map((p) => Object.fromEntries(PERFILAMIENTO_COMPRADOR_LIST_FIELDS.map((key) => [key, p[key]])));
  },

  async getPerfilamientoCompradorById(id) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    return items.find((p) => p.id === id) || null;
  },

  async addPerfilamientoComprador(clienteId, payload) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("perf"),
      cliente_id: clienteId,
      ...payload,
      usuario_creo: DEMO_ADMIN.email,
      fecha_creacion: now,
      fecha_modificacion: now,
    };
    items.push(record);
    writeStore(KEYS.perfilamientosComprador, items);
    return record;
  },

  async updatePerfilamientoComprador(id, payload) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Perfilamiento no encontrado");
    const updated = { ...items[idx], ...payload, fecha_modificacion: new Date().toISOString() };
    items[idx] = updated;
    writeStore(KEYS.perfilamientosComprador, items);
    return updated;
  },

  async deletePerfilamientoComprador(id) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    writeStore(KEYS.perfilamientosComprador, items.filter((p) => p.id !== id));
  },
};
