// Backend de modo demo (localStorage): métodos de «documents» (24). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { DEMO_ADMIN } from "../../seedData";
import { KEYS, readStore, writeStore, uid } from "./shared.js";

export const documentsMethods = {
  async getDocumentTemplates() {
    const templates = readStore(KEYS.documentTemplates, []);
    return templates.slice().sort((a, b) => a.name.localeCompare(b.name));
  },

  async createDocumentTemplate(data) {
    const templates = readStore(KEYS.documentTemplates, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("doctpl"),
      name: data.name.trim(),
      body: data.body,
      custom_fields: data.custom_fields || [],
      requires_signatures: data.requires_signatures !== false,
      active: data.active !== false,
      created_at: now,
      updated_at: now,
    };
    templates.push(record);
    writeStore(KEYS.documentTemplates, templates);
    return record;
  },

  async updateDocumentTemplate(id, data) {
    const templates = readStore(KEYS.documentTemplates, []);
    const idx = templates.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Plantilla no encontrada");
    templates[idx] = {
      ...templates[idx],
      name: data.name.trim(),
      body: data.body,
      custom_fields: data.custom_fields || [],
      requires_signatures: data.requires_signatures !== false,
      active: data.active !== false,
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.documentTemplates, templates);
    return templates[idx];
  },

  async deleteDocumentTemplate(id) {
    const templates = readStore(KEYS.documentTemplates, []);
    writeStore(KEYS.documentTemplates, templates.filter((t) => t.id !== id));
  },

  // Firma de contratos (modo demo): mismas reglas que las funciones de la base
  // (código, 5 intentos, vigencia, una sola firma), pero en localStorage.
  async getSigningRequests() {
    return readStore(KEYS.signing, [])
      .map(({ document_b64, signature_b64, fingerprint_b64, code, ...rest }) => rest)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async getSigningRequestFull(id) {
    return readStore(KEYS.signing, []).find((r) => r.id === id) || null;
  },

  async createSigningRequest({ clientId, propertyId, title, signerName, documentB64, expiresDays = 7 }) {
    const { base64ToBytes, sha256Hex } = await import("../../signing");
    const bytes = base64ToBytes(documentB64);
    if (String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") throw new Error("not_a_pdf");
    const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const record = {
      id: uid("sign"),
      token: hex(32),
      client_id: clientId || null,
      property_id: propertyId || null,
      title: title.trim(),
      signer_name: signerName.trim(),
      document_b64: documentB64,
      doc_sha256: await sha256Hex(bytes),
      code,
      failed_attempts: 0,
      status: "pendiente",
      expires_at: new Date(Date.now() + Math.max(1, Math.min(expiresDays, 60)) * 86400000).toISOString(),
      created_by: DEMO_ADMIN.email,
      created_at: new Date().toISOString(),
    };
    writeStore(KEYS.signing, [...readStore(KEYS.signing, []), record]);
    return { id: record.id, token: record.token, code, expires_at: record.expires_at };
  },

  async regenerateSigningCode(id) {
    const items = readStore(KEYS.signing, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("not_found");
    if (items[idx].status !== "pendiente") throw new Error("not_pending");
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    items[idx] = { ...items[idx], code, failed_attempts: 0 };
    writeStore(KEYS.signing, items);
    return { code };
  },

  async updateSigningRequest(id, fields) {
    const items = readStore(KEYS.signing, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("not_found");
    items[idx] = { ...items[idx], ...fields };
    writeStore(KEYS.signing, items);
  },

  async deleteSigningRequest(id) {
    writeStore(KEYS.signing, readStore(KEYS.signing, []).filter((r) => r.id !== id));
  },

  async signingInfo(token) {
    const r = readStore(KEYS.signing, []).find((x) => x.token === token);
    if (!r) return null;
    let status = r.status;
    if (status === "pendiente" && new Date(r.expires_at) < new Date()) status = "expirado";
    else if (status === "pendiente" && r.failed_attempts >= 5) status = "bloqueado";
    return { title: r.title, status };
  },

  // Devuelve null si todo está bien o el error (mismos textos que la base).
  _signingCheck(items, token, code) {
    const idx = items.findIndex((x) => x.token === token);
    if (idx === -1) return { idx, error: "not_found" };
    const r = items[idx];
    if (r.status !== "pendiente") return { idx, error: "not_pending" };
    if (new Date(r.expires_at) < new Date()) return { idx, error: "expired" };
    if (r.failed_attempts >= 5) return { idx, error: "locked" };
    if (r.code !== code) {
      items[idx] = { ...r, failed_attempts: r.failed_attempts + 1 };
      return { idx, error: "invalid_code" };
    }
    return { idx, error: null };
  },

  async signingOpen(token, code) {
    const items = readStore(KEYS.signing, []);
    const { idx, error } = this._signingCheck(items, token, code);
    writeStore(KEYS.signing, items);
    if (error) return { error };
    const r = items[idx];
    return { title: r.title, signer_name: r.signer_name, document_b64: r.document_b64, doc_sha256: r.doc_sha256 };
  },

  async signingSubmit(token, code, signedName, signatureB64) {
    const items = readStore(KEYS.signing, []);
    const { idx, error } = this._signingCheck(items, token, code);
    if (error) {
      writeStore(KEYS.signing, items);
      return { error };
    }
    if (!String(signedName || "").trim()) return { error: "name_required" };
    if (!signatureB64 || signatureB64.length > 600000 || !signatureB64.startsWith("iVBOR")) return { error: "bad_signature" };
    items[idx] = {
      ...items[idx],
      status: "firmado",
      signed_at: new Date().toISOString(),
      signed_name: signedName.trim(),
      signature_b64: signatureB64,
      signer_ip: "demo",
      signer_agent: navigator.userAgent.slice(0, 300),
    };
    writeStore(KEYS.signing, items);
    return { signed_at: items[idx].signed_at, ip: "demo" };
  },

  // Solicitudes de avalúo (modo demo: localStorage).
  async getSolicitudesAvaluo() {
    return readStore(KEYS.solicitudesAvaluo, []).sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)));
  },

  async getSolicitudAvaluoById(id) {
    return readStore(KEYS.solicitudesAvaluo, []).find((r) => r.id === id) || null;
  },

  async addSolicitudAvaluo(payload) {
    const items = readStore(KEYS.solicitudesAvaluo, []);
    const now = new Date().toISOString();
    const record = { id: uid("solicitud-avaluo"), ...payload, usuario_creo: DEMO_ADMIN.email, fecha_creacion: now, fecha_modificacion: now };
    items.push(record);
    writeStore(KEYS.solicitudesAvaluo, items);
    return record;
  },

  async updateSolicitudAvaluo(id, payload) {
    const items = readStore(KEYS.solicitudesAvaluo, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Solicitud de avalúo no encontrada");
    items[idx] = { ...items[idx], ...payload, fecha_modificacion: new Date().toISOString() };
    writeStore(KEYS.solicitudesAvaluo, items);
    return items[idx];
  },

  async deleteSolicitudAvaluo(id) {
    writeStore(KEYS.solicitudesAvaluo, readStore(KEYS.solicitudesAvaluo, []).filter((r) => r.id !== id));
  },

  // Solicitudes de crédito (modo demo: localStorage).
  async getSolicitudesCredito() {
    return readStore(KEYS.solicitudesCredito, []).sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)));
  },

  async getSolicitudCreditoById(id) {
    return readStore(KEYS.solicitudesCredito, []).find((r) => r.id === id) || null;
  },

  async addSolicitudCredito(payload) {
    const items = readStore(KEYS.solicitudesCredito, []);
    const now = new Date().toISOString();
    const record = { id: uid("solicitud-credito"), ...payload, usuario_creo: DEMO_ADMIN.email, fecha_creacion: now, fecha_modificacion: now };
    items.push(record);
    writeStore(KEYS.solicitudesCredito, items);
    return record;
  },

  async updateSolicitudCredito(id, payload) {
    const items = readStore(KEYS.solicitudesCredito, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Solicitud de crédito no encontrada");
    items[idx] = { ...items[idx], ...payload, fecha_modificacion: new Date().toISOString() };
    writeStore(KEYS.solicitudesCredito, items);
    return items[idx];
  },

  async deleteSolicitudCredito(id) {
    writeStore(KEYS.solicitudesCredito, readStore(KEYS.solicitudesCredito, []).filter((r) => r.id !== id));
  },
};
