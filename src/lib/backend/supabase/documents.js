// Backend con Supabase: métodos de «documents» (23). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { SOLICITUD_AVALUO_LIST_FIELDS } from "../../solicitudAvaluo";
import { SOLICITUD_CREDITO_LIST_FIELDS } from "../../solicitudCredito";

export const documentsMethods = {
  async getDocumentTemplates() {
    const { data, error } = await supabase.from("document_templates").select("*").order("name");
    if (error) throw error;
    return data || [];
  },

  async createDocumentTemplate(data) {
    const payload = {
      name: data.name.trim(),
      body: data.body,
      custom_fields: data.custom_fields || [],
      requires_signatures: data.requires_signatures !== false,
      active: data.active !== false,
    };
    const { data: inserted, error } = await supabase.from("document_templates").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateDocumentTemplate(id, data) {
    const payload = {
      name: data.name.trim(),
      body: data.body,
      custom_fields: data.custom_fields || [],
      requires_signatures: data.requires_signatures !== false,
      active: data.active !== false,
      updated_at: new Date().toISOString(),
    };
    const { data: updated, error } = await supabase.from("document_templates").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteDocumentTemplate(id) {
    const { error } = await supabase.from("document_templates").delete().eq("id", id);
    if (error) throw error;
  },

  // Firma de contratos desde el sitio (ver schema.sql). El personal usa la tabla
  // (RLS: apartado documentos_legales) y las funciones signing_create /
  // signing_regenerate_code; el público solo llega por signing_info / open / submit.
  async getSigningRequests() {
    const cols =
      "id,token,client_id,property_id,title,signer_name,doc_sha256,failed_attempts,status,expires_at,created_by,created_at,signed_at,signed_name,signer_ip,fingerprint_at,fingerprint_by,sealed_at";
    const { data, error } = await supabase.from("signing_requests").select(cols).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Con el PDF, la firma y la huella (pesado): solo al abrir o descargar uno.
  async getSigningRequestFull(id) {
    const { data, error } = await supabase.from("signing_requests").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async createSigningRequest({ clientId, propertyId, title, signerName, documentB64, expiresDays = 7 }) {
    const { data, error } = await supabase.rpc("signing_create", {
      p_client_id: clientId || null,
      p_property_id: propertyId || null,
      p_title: title,
      p_signer_name: signerName,
      p_document_b64: documentB64,
      p_expires_days: expiresDays,
    });
    if (error) throw error;
    return data; // { id, token, code, expires_at }
  },

  async regenerateSigningCode(id) {
    const { data, error } = await supabase.rpc("signing_regenerate_code", { p_id: id });
    if (error) throw error;
    return data; // { code }
  },

  async updateSigningRequest(id, fields) {
    const { error } = await supabase.from("signing_requests").update(fields).eq("id", id);
    if (error) throw error;
  },

  async deleteSigningRequest(id) {
    const { error } = await supabase.from("signing_requests").delete().eq("id", id);
    if (error) throw error;
  },

  async signingInfo(token) {
    const { data, error } = await supabase.rpc("signing_info", { p_token: token });
    if (error) throw error;
    return data; // null | { title, status }
  },

  async signingOpen(token, code) {
    const { data, error } = await supabase.rpc("signing_open", { p_token: token, p_code: code });
    if (error) throw error;
    return data; // { error } | { title, signer_name, document_b64, doc_sha256 }
  },

  async signingSubmit(token, code, signedName, signatureB64) {
    const { data, error } = await supabase.rpc("signing_submit", { p_token: token, p_code: code, p_signed_name: signedName, p_signature_b64: signatureB64 });
    if (error) throw error;
    return data; // { error } | { signed_at, ip }
  },

  // Solicitudes de avalúo (formato INFONAVIT). RLS: apartado 'valuacion'.
  async getSolicitudesAvaluo() {
    const { data, error } = await supabase
      .from("solicitudes_avaluo")
      .select(SOLICITUD_AVALUO_LIST_FIELDS.join(", "))
      .order("fecha_creacion", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getSolicitudAvaluoById(id) {
    const { data, error } = await supabase.from("solicitudes_avaluo").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addSolicitudAvaluo(payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, usuario_creo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("solicitudes_avaluo").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updateSolicitudAvaluo(id, payload) {
    const row = { ...payload, fecha_modificacion: new Date().toISOString() };
    const { data, error } = await supabase.from("solicitudes_avaluo").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSolicitudAvaluo(id) {
    const { error } = await supabase.from("solicitudes_avaluo").delete().eq("id", id);
    if (error) throw error;
  },

  // Solicitudes de inscripción de crédito (formato INFONAVIT). RLS: apartado 'credito_infonavit'.
  async getSolicitudesCredito() {
    const { data, error } = await supabase
      .from("solicitudes_credito")
      .select(SOLICITUD_CREDITO_LIST_FIELDS.join(", "))
      .order("fecha_creacion", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getSolicitudCreditoById(id) {
    const { data, error } = await supabase.from("solicitudes_credito").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addSolicitudCredito(payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, usuario_creo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("solicitudes_credito").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updateSolicitudCredito(id, payload) {
    const row = { ...payload, fecha_modificacion: new Date().toISOString() };
    const { data, error } = await supabase.from("solicitudes_credito").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSolicitudCredito(id) {
    const { error } = await supabase.from("solicitudes_credito").delete().eq("id", id);
    if (error) throw error;
  },
};
