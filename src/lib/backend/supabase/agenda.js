// Backend con Supabase: métodos de «agenda» (36). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { generateReportToken, REPORT_TOKEN_PATTERN, reportLinkExpiry } from "../../visitReport";
import { CITA_STATUSES } from "../../agendaCitas";
import { BOOKING_TOKEN_PATTERN, DEFAULT_VISIT_SETTINGS, hhmm, normalizeVisitSchedule } from "../../visitSlots";
import { fetchAll, isMissingTable, sanitizeFileName } from "./shared.js";

export const agendaMethods = {
  // Crea o REGENERA la URL secreta del calendario suscribible de quien llama (la anterior deja de servir).
  async createAgendaFeedToken() {
    const { data, error } = await supabase.rpc("create_agenda_feed_token");
    if (error) throw error;
    return data;
  },

  async getAgendaFeedToken() {
    const { data: session } = await supabase.auth.getSession();
    const email = session?.session?.user?.email;
    if (!email) return null;
    const { data, error } = await supabase.from("agenda_feed_tokens").select("token").eq("email", email).maybeSingle();
    if (error) {
      if (isMissingTable(error)) return null;
      throw error;
    }
    return data?.token || null;
  },

  // Visitas de prospectos a una propiedad. RLS (ver schema.sql): cada asesor
  // ve y edita solo las suyas; un correo con el apartado 'visitas' pero sin
  // asesor vinculado ve todas — mismo patrón que agenda_citas.
  async getVisits({ propertyId } = {}) {
    return fetchAll(() => {
      let query = supabase.from("property_visits").select("*").order("visited_at", { ascending: false }).order("id");
      if (propertyId) query = query.eq("property_id", propertyId);
      return query;
    });
  },

  async getVisitById(id) {
    const { data, error } = await supabase.from("property_visits").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addVisit(fields) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...fields, created_by: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("property_visits").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updateVisit(id, fields) {
    const { data, error } = await supabase
      .from("property_visits")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteVisit(id) {
    const { error } = await supabase.from("property_visits").delete().eq("id", id);
    if (error) throw error;
  },

  // Primer horario libre de cada propiedad dada, de un golpe (next_visit_slots, schema.sql): para la etiqueta
  // «Visítala mañana» de las tarjetas. Si la función aún no existe en la base devuelve [] (no hay etiquetas).
  async getNextVisitSlots(propertyIds) {
    const ids = [...new Set(propertyIds || [])].slice(0, 48);
    if (ids.length === 0) return [];
    const { data, error } = await supabase.rpc("next_visit_slots", { p_property_ids: ids });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  },

  // Informe de UNA propiedad, ya anonimizado: { property, sold_on, visits:
  // [{ visited_at, interest, reasons, comments }] }. Es el mismo JSON que
  // recibe el vendedor por el enlace, y suma las visitas de TODOS los
  // asesores aunque la tabla de visitas solo le muestre al asesor las suyas
  // (por eso sale de una función SQL y no de leer property_visits).
  async getVisitReport(propertyId) {
    const { data, error } = await supabase.rpc("visit_report", { p_property_id: propertyId });
    if (error) throw error;
    return data;
  },

  async getReportLink(propertyId) {
    const { data, error } = await supabase.from("property_report_links").select("*").eq("property_id", propertyId).maybeSingle();
    if (error) throw error;
    return data;
  },

  // Crea el enlace secreto de la propiedad o, si ya había uno, lo REGENERA: el
  // token anterior deja de funcionar en el acto.
  async saveReportLink(propertyId) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      property_id: propertyId,
      token: generateReportToken(),
      created_by: sessionData?.session?.user?.email || null,
      created_at: new Date().toISOString(),
      expires_at: reportLinkExpiry(),
    };
    const { data, error } = await supabase.from("property_report_links").upsert(row, { onConflict: "property_id" }).select().single();
    if (error) throw error;
    return data;
  },

  async deleteReportLink(propertyId) {
    const { error } = await supabase.from("property_report_links").delete().eq("property_id", propertyId);
    if (error) throw error;
  },

  // Página pública /informe/<token>, SIN sesión: solo esta función es
  // ejecutable por anon (las tablas siguen cerradas). null = enlace
  // inexistente, regenerado o desactivado. Un token con formato inválido ni
  // siquiera se manda a la base.
  async getVisitReportByToken(token) {
    if (!REPORT_TOKEN_PATTERN.test(token || "")) return null;
    const { data, error } = await supabase.rpc("visit_report_by_token", { p_token: token });
    if (error) throw error;
    return data || null;
  },

  async getAgendaCitas() {
    return fetchAll(() =>
      supabase
        .from("agenda_citas")
        .select("*")
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true, nullsFirst: false })
        .order("id"),
    );
  },

  // `contact_*`: datos de quien no es un cliente registrado (para mandarle el enlace de la cita). Como `lugar`,
  // solo se mandan si se capturaron. La cita trae su `booking_token` por omisión (ver "fase 8" en schema.sql).
  // `id` (opcional): lo pone quien guarda sin señal (cola de offlineQueue.js) para que un reenvío no duplique la cita.
  async addAgendaCita({ id, advisor_id, client_id, titulo, fecha, hora, actividades, lugar, contact_name, contact_phone, contact_email, property_id, prospecto_id }) {
    const payload = {
      ...(id ? { id } : {}),
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
      // Solo se manda si se capturó: así guardar una cita no depende de que la
      // columna `lugar` ya exista en bases que aún no corren su migración.
      ...(lugar?.trim() ? { lugar: lugar.trim() } : {}),
      ...(contact_name?.trim() ? { contact_name: contact_name.trim() } : {}),
      ...(contact_phone?.trim() ? { contact_phone: contact_phone.trim() } : {}),
      ...(contact_email?.trim() ? { contact_email: contact_email.trim() } : {}),
      // La propiedad que se enseña y el prospecto del que sale la cita (opcionales).
      ...(property_id ? { property_id } : {}),
      ...(prospecto_id ? { prospecto_id } : {}),
    };
    const { data, error } = await supabase.from("agenda_citas").insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async getAgendaCitaById(id) {
    const { data, error } = await supabase.from("agenda_citas").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  // `lugar`: undefined = no tocarlo; texto vacío = borrarlo.
  async updateAgendaCita(id, { advisor_id, client_id, titulo, fecha, hora, actividades, lugar, contact_name, contact_phone, contact_email, property_id }) {
    const payload = {
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
      ...(lugar !== undefined ? { lugar: lugar?.trim() || null } : {}),
      // Los datos de contacto: undefined = no tocarlos; texto vacío = borrarlos.
      ...(contact_name !== undefined ? { contact_name: contact_name?.trim() || null } : {}),
      ...(contact_phone !== undefined ? { contact_phone: contact_phone?.trim() || null } : {}),
      ...(contact_email !== undefined ? { contact_email: contact_email?.trim() || null } : {}),
      // undefined = no tocarla; vacío = quitarla.
      ...(property_id !== undefined ? { property_id: property_id || null } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("agenda_citas").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteAgendaCita(id) {
    const { error } = await supabase.from("agenda_citas").delete().eq("id", id);
    if (error) throw error;
  },

  // Cambia el estatus de una cita desde la Agenda (realizada, no asistió,
  // cancelada o reactivarla como confirmada). Al cancelar queda quién y por qué;
  // al reactivar se borra la cancelación. Una cita cancelada libera su horario.
  async setAgendaCitaStatus(id, status, { reason } = {}) {
    if (!CITA_STATUSES.includes(status)) throw new Error("Estatus de cita no válido");
    const cancelling = status === "cancelada";
    const { data, error } = await supabase
      .from("agenda_citas")
      .update({
        status,
        cancelled_by: cancelling ? "asesor" : null,
        cancelled_reason: cancelling ? String(reason ?? "").trim().slice(0, 300) || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAgendaExpedientes(citaId) {
    const { data, error } = await supabase
      .from("agenda_expedientes")
      .select("*")
      .eq("cita_id", citaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];
    const paths = data.map((d) => d.file_path);
    const { data: signed } = await supabase.storage.from("agenda-expedientes").createSignedUrls(paths, 300);
    return data.map((entry, i) => ({ ...entry, signed_url: signed?.[i]?.signedUrl || null }));
  },

  async addAgendaExpediente({ cita_id, file }) {
    const path = `${cita_id}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("agenda-expedientes")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("agenda_expedientes")
      .insert({ cita_id, file_path: path, file_name: file.name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAgendaExpediente(id) {
    const { data: entry } = await supabase.from("agenda_expedientes").select("file_path").eq("id", id).maybeSingle();
    if (entry?.file_path) {
      await supabase.storage.from("agenda-expedientes").remove([entry.file_path]);
    }
    const { error } = await supabase.from("agenda_expedientes").delete().eq("id", id);
    if (error) throw error;
  },

  // ── Agendar visita con horarios reales ──
  // Las seis primeras son las únicas puertas del navegador sin sesión: funciones
  // security definer de schema.sql ("Agendar visita con horarios reales"). Las
  // de reservar / reprogramar / cancelar / confirmar NO lanzan por reglas de
  // negocio: devuelven { ok: true, ... } o { error: "codigo" } (slot_unavailable,
  // rate_limited, too_late…) para que la pantalla muestre el mensaje correcto.
  async getVisitSlots(propertyId, { from = null, days = 14 } = {}) {
    const { data, error } = await supabase.rpc("get_visit_slots", { p_property_id: propertyId, p_from: from, p_days: days });
    if (error) throw error;
    return data?.slots || [];
  },

  async bookVisit({ propertyId, fecha, hora, name, email, phone, note }) {
    const { data, error } = await supabase.rpc("book_visit", {
      p_property_id: propertyId,
      p_fecha: fecha,
      p_hora: hora,
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_note: note || null,
    });
    if (error) throw error;
    return data;
  },

  // Solicitud de visita SIN asesor (el visitante propone día y hora; queda en la Agenda de todos hasta que
  // alguien la toma). Devuelve { ok, token, fecha, hora, property } o { error } como bookVisit.
  async requestVisit({ propertyId, fecha, hora, name, email, phone, note }) {
    const { data, error } = await supabase.rpc("request_visit", {
      p_property_id: propertyId,
      p_fecha: fecha,
      p_hora: hora,
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_note: note || null,
    });
    if (error) throw error;
    return data;
  },

  // Con sesión: tomar una solicitud sin asesor. Un asesor la toma para sí (el servidor usa su propio id);
  // administración, que no tiene asesor vinculado, manda el `advisorId` al que se la asigna.
  // Devuelve { ok } o { error }: already_taken, advisor_required, invalid_advisor, not_authorized, not_found.
  async claimVisitRequest(citaId, { advisorId = null } = {}) {
    const { data, error } = await supabase.rpc("claim_visit_request", { p_cita_id: citaId, p_advisor_id: advisorId });
    if (error) throw error;
    return data;
  },

  // Encuesta tras la visita (get_visit_survey / submit_visit_feedback / visit_feedback en schema.sql).
  // El cliente entra con el mismo token de su visita. Si las funciones aún no existen en la base, la página dice
  // que la encuesta no está disponible en vez de romperse.
  async getVisitSurvey(token) {
    const { data, error } = await supabase.rpc("get_visit_survey", { p_token: token });
    if (error) throw error;
    return data;
  },

  async submitVisitFeedback(token, rating, comment = null) {
    const { data, error } = await supabase.rpc("submit_visit_feedback", { p_token: token, p_rating: rating, p_comment: comment });
    if (error) throw error;
    return data;
  },

  // Opiniones de las visitas (RLS: cada asesor las suyas, la oficina todas). Sin la tabla devuelve [].
  async getVisitFeedback() {
    const { data, error } = await supabase.from("visit_feedback").select("*").order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  },

  async getVisitBooking(token) {
    if (!BOOKING_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const { data, error } = await supabase.rpc("get_booking", { p_token: token });
    if (error) throw error;
    return data || { status: "invalido" };
  },

  // Horarios libres del MISMO asesor de esta visita, para moverla (la de la ficha
  // mezcla a todos los asesores de la propiedad y daría horarios que luego se rechazan).
  async getBookingSlots(token, { days = 14 } = {}) {
    if (!BOOKING_TOKEN_PATTERN.test(token || "")) return [];
    const { data, error } = await supabase.rpc("get_booking_slots", { p_token: token, p_days: days });
    if (error) throw error;
    return data?.slots || [];
  },

  async rescheduleVisitBooking(token, fecha, hora) {
    const { data, error } = await supabase.rpc("reschedule_booking", { p_token: token, p_fecha: fecha, p_hora: hora });
    if (error) throw error;
    return data;
  },

  async cancelVisitBooking(token, reason) {
    const { data, error } = await supabase.rpc("cancel_booking", { p_token: token, p_reason: reason || null });
    if (error) throw error;
    return data;
  },

  async confirmVisitAttendance(token) {
    const { data, error } = await supabase.rpc("confirm_booking_attendance", { p_token: token });
    if (error) throw error;
    return data;
  },

  // Horario de visitas de un asesor (con sesión; RLS: el suyo, o todos si el
  // acceso de Agenda no tiene asesor vinculado). Sin fila de ajustes devuelve
  // la reserva desactivada: nadie ofrece horarios hasta que se active a propósito.
  async getAdvisorVisitSchedule(advisorId) {
    const [settingsRes, weeklyRes, timeOffRes] = await Promise.all([
      supabase.from("advisor_visit_settings").select("*").eq("advisor_id", advisorId).maybeSingle(),
      supabase.from("advisor_availability").select("*").eq("advisor_id", advisorId).order("weekday").order("start_time"),
      supabase.from("advisor_time_off").select("*").eq("advisor_id", advisorId).order("fecha_inicio"),
    ]);
    for (const res of [settingsRes, weeklyRes, timeOffRes]) if (res.error) throw res.error;
    const settings = settingsRes.data
      ? { enabled: settingsRes.data.enabled, slot_minutes: settingsRes.data.slot_minutes, min_notice_hours: settingsRes.data.min_notice_hours, horizon_days: settingsRes.data.horizon_days }
      : { ...DEFAULT_VISIT_SETTINGS, enabled: false };
    return {
      settings,
      weekly: (weeklyRes.data || []).map((w) => ({ weekday: w.weekday, start_time: hhmm(w.start_time), end_time: hhmm(w.end_time) })),
      timeOff: (timeOffRes.data || []).map((o) => ({ id: o.id, fecha_inicio: o.fecha_inicio, fecha_fin: o.fecha_fin, motivo: o.motivo })),
    };
  },

  // Reemplaza el horario completo. Primero inserta lo nuevo y al final borra lo
  // viejo (por id): si algo falla a la mitad, el asesor se queda con horario de
  // más, nunca sin horario.
  async saveAdvisorVisitSchedule(advisorId, input) {
    const { settings, weekly, timeOff } = normalizeVisitSchedule(input);

    const { error: settingsError } = await supabase
      .from("advisor_visit_settings")
      .upsert({ advisor_id: advisorId, ...settings, updated_at: new Date().toISOString() }, { onConflict: "advisor_id" });
    if (settingsError) throw settingsError;

    const replaceRows = async (table, rows) => {
      const { data: old, error: oldError } = await supabase.from(table).select("id").eq("advisor_id", advisorId);
      if (oldError) throw oldError;
      if (rows.length > 0) {
        const { error } = await supabase.from(table).insert(rows.map((row) => ({ ...row, advisor_id: advisorId })));
        if (error) throw error;
      }
      const oldIds = (old || []).map((row) => row.id);
      if (oldIds.length > 0) {
        const { error } = await supabase.from(table).delete().in("id", oldIds);
        if (error) throw error;
      }
    };
    await replaceRows("advisor_availability", weekly);
    await replaceRows("advisor_time_off", timeOff);
    return this.getAdvisorVisitSchedule(advisorId);
  },
};
