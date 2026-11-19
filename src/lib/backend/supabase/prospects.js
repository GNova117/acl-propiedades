// Backend con Supabase: métodos de «prospects» (27). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { getOrCreateVisitorId } from "../../visitorId";
import { cleanSelectionInput } from "../../selections";
import { isMissingTable } from "./shared.js";

export const prospectsMethods = {
  // Fusiona dos prospectos duplicados (merge_prospects, schema.sql). Devuelve { ok } o lanza `merge:<motivo>`.
  async mergeProspects(keepId, removeId) {
    const { data, error } = await supabase.rpc("merge_prospects", { p_keep: keepId, p_remove: removeId });
    if (error) throw error;
    if (data?.error) throw new Error(`merge:${data.error}`);
    return data;
  },

  // Prospectos por etapas. RLS: apartado 'prospectos'; un asesor con login
  // vinculado ve solo los suyos (ver schema.sql).
  async getProspects() {
    const { data, error } = await supabase.from("prospectos").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Selección de propiedades en un solo enlace (ver schema.sql: property_selections y selection_open). El público solo
  // usa selection_open (anota la apertura); el personal ve y crea filas por RLS (cada asesor las suyas).
  async createSelection({ propertyIds, title, note, advisorId = null, prospectoId = null }) {
    const clean = cleanSelectionInput({ propertyIds, title, note });
    if (clean.property_ids.length === 0) throw new Error("Elige al menos una propiedad");
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...clean, advisor_id: advisorId, prospecto_id: prospectoId, created_by: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("property_selections").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async getSelections() {
    const { data, error } = await supabase.from("property_selections").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async revokeSelection(id) {
    const { data, error } = await supabase.from("property_selections").update({ revoked_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  // Cliente: «me gusta / no me gusta» y comentario por propiedad de su selección (selection_react, schema.sql).
  // Devuelve { ok, reactions } o { error }.
  async reactToSelection(token, propertyId, { reaction = null, comment = null } = {}) {
    const { data, error } = await supabase.rpc("selection_react", { p_token: token, p_property_id: propertyId, p_reaction: reaction, p_comment: comment });
    if (error) throw error;
    return data;
  },

  // Favorito o «compartir» de un visitante (track_property_event, schema.sql): cuenta para el informe del
  // vendedor. Sin esperar respuesta ni mostrar errores: es solo una cifra.
  async trackPropertyEvent(propertyId, kind) {
    const { error } = await supabase.rpc("track_property_event", { p_property_id: propertyId, p_visitor_id: getOrCreateVisitorId(), p_kind: kind });
    if (error) throw error;
  },

  async openSelection(token, { track = true } = {}) {
    const { data, error } = await supabase.rpc("selection_open", { p_token: token, p_track: track });
    if (error) throw error;
    return data;
  },

  // Alertas de propiedades por WhatsApp (ver schema.sql). El público solo usa
  // alert_subscribe / alert_unsubscribe; el personal ve la tabla (RLS: 'prospectos').
  async subscribeAlert({ kind, name, phone, contactMethod, email, criteria, propertyId }) {
    const { data, error } = await supabase.rpc("alert_subscribe", {
      p_kind: kind,
      p_name: name,
      p_phone: phone || null,
      p_criteria: criteria || {},
      p_property_id: propertyId || null,
      p_contact_method: contactMethod || "whatsapp",
      p_email: email || null,
    });
    if (error) throw error;
    return data; // { ok, duplicate? } | { error }
  },

  async unsubscribeAlert(token) {
    const { data, error } = await supabase.rpc("alert_unsubscribe", { p_token: token });
    if (error) throw error;
    return data; // { ok } | { error }
  },

  async getAlerts() {
    const cols = "id,kind,name,phone,email,contact_method,criteria,property_id,price_at_subscribe,active,created_at,last_notified_at";
    const { data, error } = await supabase.from("property_alerts").select(cols).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async setAlertActive(id, active) {
    const { error } = await supabase.from("property_alerts").update({ active }).eq("id", id);
    if (error) throw error;
  },

  async deleteAlert(id) {
    const { error } = await supabase.from("property_alerts").delete().eq("id", id);
    if (error) throw error;
  },

  // Historial de etapas de los prospectos (lo llena un trigger; ver schema.sql).
  async getProspectStageHistory() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("prospecto_etapas").select("prospecto_id, stage, at").order("at", { ascending: true }).range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  },

  async getProspectById(id) {
    const { data, error } = await supabase.from("prospectos").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  // ¿Ya existe un prospecto o cliente con este teléfono/correo? Va por una
  // función SQL porque un asesor solo lee sus propios prospectos y el aviso debe
  // cubrir los de todos (ver find_contact_duplicates en schema.sql). El aviso
  // nunca debe impedir guardar: sin la función (migración sin correr) o sin
  // conexión, simplemente no hay aviso.
  async findContactDuplicates({ phone, email, excludeProspectId }) {
    const { data, error } = await supabase.rpc("find_contact_duplicates", {
      p_phone: phone || null,
      p_email: email || null,
      p_exclude: excludeProspectId || null,
    });
    if (error) return [];
    return data || [];
  },

  async addProspect(fields) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...fields, created_by: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("prospectos").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async addProspects(rows) {
    if (rows.length === 0) return [];
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData?.session?.user?.email || null;
    const { data, error } = await supabase.from("prospectos").insert(rows.map((r) => ({ ...r, created_by: email }))).select();
    if (error) throw error;
    return data || [];
  },

  async updateProspect(id, fields) {
    const { data, error } = await supabase
      .from("prospectos")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProspect(id) {
    const { error } = await supabase.from("prospectos").delete().eq("id", id);
    if (error) throw error;
  },

  // Historial de contactos de un prospecto (llamadas, WhatsApp...). RLS: hereda
  // la de prospectos. Si el bloque "Registro de contactos" de schema.sql aún no
  // se corrió, el historial sale vacío y registrar un contacto sigue
  // actualizando al prospecto (solo se pierde la fila del historial).
  async getProspectContacts(prospectId) {
    const { data, error } = await supabase
      .from("prospecto_contactos")
      .select("id, channel, note, at, actor")
      .eq("prospecto_id", prospectId)
      .order("at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
    return data || [];
  },

  // Registra un contacto: primero actualiza al prospecto (`fields` ya viene
  // calculado por contactUpdateFields; es idempotente) y luego guarda la fila
  // del historial. Devuelve el prospecto actualizado.
  // Contactos registrados desde `sinceISO` (RLS: un asesor cuenta solo los de sus
  // prospectos). Solo el conteo, sin traer filas. Alimenta "Mi mes" (lib/goals.js).
  // Fechas de los contactos registrados en los últimos `days` días, de todos los prospectos que el usuario puede ver (RLS):
  // alimenta la secuencia de seguimiento sugerida (cuántos contactos lleva cada prospecto). Sin la tabla devuelve [].
  async getProspectContactLog(days = 45) {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await supabase.from("prospecto_contactos").select("prospecto_id, at").gte("at", since);
    if (error) return [];
    return data || [];
  },

  async countProspectContactsSince(sinceISO) {
    const { count, error } = await supabase.from("prospecto_contactos").select("id", { count: "exact", head: true }).gte("at", sinceISO);
    if (error) return 0;
    return count ?? 0;
  },

  // Conteos del mes de cada asesor activo para la tabla de posiciones (team_leaderboard, schema.sql). Sin la función
  // todavía en la base devuelve [] y la tarjeta no se muestra.
  async getTeamLeaderboard() {
    const { data, error } = await supabase.rpc("team_leaderboard");
    if (error) return [];
    return Array.isArray(data) ? data : [];
  },

  // Meta mensual del asesor (una fila por asesor, ver advisor_goals en schema.sql).
  // Sin la tabla (migración sin correr) se lee como "sin meta"; guardar sí avisa.
  async getAdvisorGoals(advisorId) {
    const { data, error } = await supabase.from("advisor_goals").select("*").eq("advisor_id", advisorId).maybeSingle();
    if (error) return null;
    return data;
  },

  async saveAdvisorGoals(advisorId, columns) {
    const { data, error } = await supabase
      .from("advisor_goals")
      .upsert({ advisor_id: advisorId, ...columns, updated_at: new Date().toISOString() }, { onConflict: "advisor_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async logProspectContact(prospectId, fields, { channel, note }) {
    const updated = await this.updateProspect(prospectId, fields);
    const text = String(note ?? "").trim();
    const { error } = await supabase.from("prospecto_contactos").insert({ prospecto_id: prospectId, channel, note: text === "" ? null : text });
    if (error && !isMissingTable(error)) throw error;
    return updated;
  },
};
