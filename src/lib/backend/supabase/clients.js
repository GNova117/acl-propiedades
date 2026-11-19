// Backend con Supabase: métodos de «clients» (33). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { PERFILAMIENTO_VENDEDOR_LIST_FIELDS } from "../../perfilamientoVendedor";
import { PERFILAMIENTO_COMPRADOR_LIST_FIELDS } from "../../perfilamientoComprador";
import { generatePortalToken, PORTAL_TOKEN_PATTERN, PORTAL_TOKEN_TTL_DAYS, PortalUploadError, blobToBase64 } from "../../clientPortal";
import { generateIntakeToken, intakeExpiry, INTAKE_TOKEN_PATTERN } from "../../clientIntake";
import { clientExpedientePayload } from "./shared.js";

export const clientsMethods = {
  // Las dos de abajo leen de `clients_decrypted` (vista, ver supabase/schema.sql
  // "Cifrado de la contraseña del portal de crédito"), no de la tabla: la
  // tabla guarda `contrasena_portal` cifrada y esta vista la descifra al
  // vuelo para quien tenga el apartado 'clientes' — la app recibe el mismo
  // shape de siempre, en claro, sin ningún cambio aparte de estas dos líneas.
  // Insert/update/delete sí van contra la tabla real: el trigger de ese mismo
  // bloque cifra automáticamente lo que llegue en `contrasena_portal`.
  async getClients(filters = {}) {
    let query = supabase.from("clients_decrypted").select("*").order("created_at", { ascending: false });
    if (filters.type) query = query.eq("type", filters.type);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getClientById(id) {
    const { data, error } = await supabase.from("clients_decrypted").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addClient(data) {
    const payload = {
      name: data.name,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      active: data.active !== false,
      financiamiento: data.financiamiento || null,
      ...clientExpedientePayload(data),
    };
    const { data: inserted, error } = await supabase.from("clients").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateClient(id, data) {
    const payload = {
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
    const { data: updated, error } = await supabase.from("clients").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteClient(id) {
    const { data: docs } = await supabase.from("client_documents").select("file_path").eq("client_id", id);
    if (docs?.length) {
      await supabase.storage.from("client-documents").remove(docs.map((d) => d.file_path));
    }
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
  },

  async getClientDocuments(clientId) {
    const { data, error } = await supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", clientId)
      .order("captured_at", { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];
    const paths = data.map((d) => d.file_path);
    const { data: signed } = await supabase.storage.from("client-documents").createSignedUrls(paths, 300);
    return data.map((doc, i) => ({ ...doc, signed_url: signed?.[i]?.signedUrl || null }));
  },

  // getClientDocuments firma todos los documentos con una URL que expira a
  // los 300s (ver arriba) — si la pantalla de documentos se queda abierta
  // más tiempo que eso, esa URL ya está vencida al momento de dar
  // "Descargar PDF" o abrir la vista previa. Se vuelve a firmar al vuelo
  // justo antes de usarla en lugar de confiar en la que trae doc.signed_url.
  async getClientDocumentUrl(doc) {
    const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(doc.file_path, 300);
    if (error) throw error;
    return data.signedUrl;
  },

  async addClientDocument({ client_id, doc_type, blob, quality_metrics }) {
    // La foto capturada por cámara siempre es un jpeg (canvasToBlob en
    // DocumentCapture.jsx), pero un PDF subido directo trae su propio
    // blob.type — se respeta en vez de forzar siempre jpeg, para que el
    // archivo se sirva/abra correctamente después.
    const isPdf = blob.type === "application/pdf";
    const path = `${client_id}/${doc_type}-${Date.now()}.${isPdf ? "pdf" : "jpg"}`;
    const { error: uploadError } = await supabase.storage
      .from("client-documents")
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("client_documents")
      .insert({ client_id, doc_type, file_path: path, quality_metrics: quality_metrics || {} })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteClientDocument(id) {
    const { data: doc } = await supabase.from("client_documents").select("file_path").eq("id", id).maybeSingle();
    if (doc?.file_path) {
      await supabase.storage.from("client-documents").remove([doc.file_path]);
    }
    const { error } = await supabase.from("client_documents").delete().eq("id", id);
    if (error) throw error;
  },

  // Un cliente tiene a lo más un vínculo activo a la vez (no hace falta
  // una restricción única en la BD para esto, se cuida desde el UI) —
  // .limit(1) en vez de .maybeSingle() por si alguna vez hay más de una
  // fila, no truena, solo toma la primera.
  async getClientLink(clientId) {
    const { data, error } = await supabase
      .from("client_links")
      .select("*")
      .or(`client_a_id.eq.${clientId},client_b_id.eq.${clientId}`)
      .limit(1);
    if (error) throw error;
    const link = data?.[0];
    if (!link) return null;
    const otherId = link.client_a_id === clientId ? link.client_b_id : link.client_a_id;
    const other = await this.getClientById(otherId);
    return { ...link, other_client: other };
  },

  // Todos los vínculos, sin filtrar por cliente — para la pantalla de
  // selección del PDF masivo (AdminClients.jsx), que necesita saber de una
  // vez quién está vinculado con quién para marcar la pareja automático.
  async getAllClientLinks() {
    const { data, error } = await supabase.from("client_links").select("client_a_id, client_b_id");
    if (error) throw error;
    return data || [];
  },

  async linkClients(clientAId, clientBId, label) {
    const { data, error } = await supabase
      .from("client_links")
      .insert({ client_a_id: clientAId, client_b_id: clientBId, label: label || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async unlinkClients(linkId) {
    const { error } = await supabase.from("client_links").delete().eq("id", linkId);
    if (error) throw error;
  },

  // ── Portal de documentos para clientes (/documentos/<token>) ──
  // Lado del asesor: generar/revocar el enlace y aprobar/rechazar lo que
  // suba el cliente. Todo bajo las políticas RLS normales de "clientes" —
  // sin funciones security definer de por medio, igual que saveReportLink.
  async getClientPortalToken(clientId) {
    const { data, error } = await supabase.from("client_portal_tokens").select("*").eq("client_id", clientId).maybeSingle();
    if (error) throw error;
    return data;
  },

  // Crea el enlace o, si ya había uno, lo REGENERA: el token anterior deja
  // de servir en el acto (unique en client_id, ver schema.sql).
  async saveClientPortalToken(clientId) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      client_id: clientId,
      token: generatePortalToken(),
      active: true,
      created_by: sessionData?.session?.user?.email || null,
      expires_at: new Date(Date.now() + PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
    const { data, error } = await supabase.from("client_portal_tokens").upsert(row, { onConflict: "client_id" }).select().single();
    if (error) throw error;
    return data;
  },

  async revokeClientPortalToken(clientId) {
    const { error } = await supabase.from("client_portal_tokens").update({ active: false }).eq("client_id", clientId);
    if (error) throw error;
  },

  // ── Enlace para que el cliente mismo capture sus datos (/registro/<token>) ──
  // Lado del asesor: crear, listar y desactivar enlaces (políticas RLS del apartado «clientes»). El TIPO lo elige el asesor aquí;
  // el cliente no lo cambia.
  async getClientIntakeLinks() {
    const { data, error } = await supabase.from("client_intake_links").select("*, client:clients!client_id(name)").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return (data || []).map(({ client, ...link }) => ({ ...link, client_name: client?.name || null }));
  },

  async createClientIntakeLink({ type, label, advisorId }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      token: generateIntakeToken(),
      type,
      label: label?.trim() ? label.trim() : null,
      created_by: sessionData?.session?.user?.email || null,
      advisor_id: advisorId || null, // a quién avisar (y a quién le escribe el cliente al terminar); sin asesor, a la oficina
      expires_at: intakeExpiry(),
    };
    const { data, error } = await supabase.from("client_intake_links").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async revokeClientIntakeLink(id) {
    const { error } = await supabase.from("client_intake_links").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("submitted_at", null);
    if (error) throw error;
  },

  // Los registros ya llenos se marcan como vistos al abrir el panel: dejan de contar en la campana.
  async markClientIntakesSeen(ids) {
    if (!ids?.length) return;
    const { error } = await supabase.from("client_intake_links").update({ seen_at: new Date().toISOString() }).in("id", ids).is("seen_at", null);
    if (error) throw error;
  },

  // Lado del cliente (sin sesión, solo token): funciones security definer, la tabla sigue cerrada.
  async getClientIntakeStatus(token) {
    if (!INTAKE_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const { data, error } = await supabase.rpc("client_intake_status", { p_token: token });
    if (error) throw error;
    return data || { status: "invalido" };
  },

  // { ok: true } o { ok: false, error: '<código>' } (ver client_intake_submit). Un 54429 (demasiados envíos) llega como error.
  async submitClientIntake(token, data, consentVersion) {
    const { data: result, error } = await supabase.rpc("client_intake_submit", { p_token: token, p_data: data, p_consent_version: consentVersion });
    if (error) {
      if (error.code === "54429") return { ok: false, error: "rate_limited" };
      throw error;
    }
    return result || { ok: false, error: "invalido" };
  },

  // Estatus del trámite y documentos que se le piden al cliente en el
  // portal (client_tramites, una fila por cliente). null si nunca se ha
  // guardado: la pantalla usa entonces los valores por omisión.
  async getClientTramite(clientId) {
    const { data, error } = await supabase.from("client_tramites").select("*").eq("client_id", clientId).maybeSingle();
    if (error) throw error;
    return data;
  },

  // `notifyClient` es opcional a propósito: solo entra al upsert si viene (la pantalla lo manda únicamente cuando
  // el asesor lo cambió), así guardar el trámite no depende de que la columna notify_client ya exista
  // (bloque «Avisos por correo al cliente del portal» de schema.sql).
  async saveClientTramite(clientId, { stage, note, requestedDocs, notifyClient }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      client_id: clientId,
      stage,
      note: note?.trim() ? note.trim() : null,
      requested_docs: requestedDocs,
      ...(notifyClient === undefined ? {} : { notify_client: Boolean(notifyClient) }),
      updated_by: sessionData?.session?.user?.email || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("client_tramites").upsert(row, { onConflict: "client_id" }).select().single();
    if (error) throw error;
    return data;
  },

  // Aprobar/rechazar un documento subido por el portal. clientId se pide
  // aparte (en vez de volver a consultar el documento) porque quien llama
  // ya lo tiene a la mano en la lista que está mostrando.
  async reviewClientDocument(documentId, clientId, { reviewStatus, reviewNotes }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const reviewedBy = sessionData?.session?.user?.email || null;
    const { error } = await supabase
      .from("client_documents")
      .update({ review_status: reviewStatus, review_notes: reviewNotes || null, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
      .eq("id", documentId);
    if (error) throw error;
    await supabase.from("document_access_log").insert({
      client_document_id: documentId,
      client_id: clientId,
      actor_type: "admin",
      actor_ref: reviewedBy,
      action: reviewStatus === "rechazado" ? "reject" : "approve",
    });
  },

  // ── Portal de documentos: lado del cliente (sin sesión, solo token) ──
  // Las tres son funciones security definer: la tabla sigue cerrada, solo
  // ellas pueden leer/escribir validando el token por su cuenta.
  async getPortalStatus(token) {
    if (!PORTAL_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const { data, error } = await supabase.rpc("portal_token_status", { p_token: token });
    if (error) throw error;
    return data || { status: "invalido" };
  },

  async registerPortalConsent(token, consentVersion) {
    const { data, error } = await supabase.rpc("portal_register_consent", { p_token: token, p_consent_version: consentVersion });
    if (error) throw error;
    return data;
  },

  async confirmPortalDocument(token, documentId, extractedData, clientConfirmed) {
    const { data, error } = await supabase.rpc("portal_confirm_document", {
      p_token: token,
      p_document_id: documentId,
      p_extracted_data: extractedData,
      p_client_confirmed: clientConfirmed,
    });
    if (error) throw error;
    return data;
  },

  // Sube el archivo a api/portal-upload.js (única pieza que usa la llave de
  // servicio) — aquí solo se convierte a base64 y se interpreta la
  // respuesta. file es un File/Blob (PDF o imagen de respaldo).
  async uploadPortalDocument(token, { docType, fileKind, file }) {
    const fileBase64 = await blobToBase64(file);
    const res = await fetch("/api/portal-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, docType, fileKind, fileBase64 }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new PortalUploadError(body?.error || "server_error");
    return body.document;
  },

  // La lista omite RFC/CURP/identificación: solo se piden al abrir uno.
  async getPerfilamientosVendedor(clienteId) {
    const { data, error } = await supabase
      .from("perfilamientos")
      .select(PERFILAMIENTO_VENDEDOR_LIST_FIELDS.join(", "))
      .eq("cliente_id", clienteId)
      .order("fecha_creacion", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getPerfilamientoVendedorById(id) {
    const { data, error } = await supabase.from("perfilamientos").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addPerfilamientoVendedor(clienteId, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, cliente_id: clienteId, usuario_creo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("perfilamientos").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updatePerfilamientoVendedor(id, payload) {
    const row = { ...payload, fecha_modificacion: new Date().toISOString() };
    const { data, error } = await supabase.from("perfilamientos").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePerfilamientoVendedor(id) {
    const { error } = await supabase.from("perfilamientos").delete().eq("id", id);
    if (error) throw error;
  },

  // Lista omite NSS/CURP/RFC/contraseña de portal: solo se piden al abrir uno.
  async getPerfilamientosComprador(clienteId) {
    const { data, error } = await supabase
      .from("perfilamientos_comprador")
      .select(PERFILAMIENTO_COMPRADOR_LIST_FIELDS.join(", "))
      .eq("cliente_id", clienteId)
      .order("fecha_creacion", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Lee de `perfilamientos_comprador_decrypted` (vista que descifra
  // `contrasena_portal` al vuelo) por el mismo motivo que getClientById.
  // Insert/update/delete siguen contra la tabla real: el trigger cifra solo.
  async getPerfilamientoCompradorById(id) {
    const { data, error } = await supabase.from("perfilamientos_comprador_decrypted").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addPerfilamientoComprador(clienteId, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, cliente_id: clienteId, usuario_creo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("perfilamientos_comprador").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updatePerfilamientoComprador(id, payload) {
    const row = { ...payload, fecha_modificacion: new Date().toISOString() };
    const { data, error } = await supabase.from("perfilamientos_comprador").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePerfilamientoComprador(id) {
    const { error } = await supabase.from("perfilamientos_comprador").delete().eq("id", id);
    if (error) throw error;
  },
};
