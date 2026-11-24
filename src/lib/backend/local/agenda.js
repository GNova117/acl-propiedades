// Backend de modo demo (localStorage): métodos de «agenda» (38). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { ADVISORS, PROPERTIES, VISITS_SEED, DEMO_ADMIN } from "../../seedData";
import { generateReportToken, REPORT_TOKEN_PATTERN } from "../../visitReport";
import { CITA_STATUSES } from "../../agendaCitas";
import { findOpenProspect, mergeBookingIntoProspect, prospectFieldsFromBooking } from "../../visitProspect";
import { BOOKING_TOKEN_PATTERN, DEFAULT_VISIT_SETTINGS, MAX_ACTIVE_BOOKINGS_PER_PHONE, activeBookingsForPhone, bookingPermissions, buildBookingChangeMessage, buildBookingMessage, buildRequestMessage, generateBookingToken, generateSlots, hhmm, mergeSlots, mexicoParts, normalizeVisitSchedule, addDays, phoneDigits, pickAdvisor, requestSlotError, validateBookingInput, MAX_RESCHEDULES } from "../../visitSlots";
import { KEYS, readStore, writeStore, uid, duplicateKeyError, filesToDataUrls } from "./shared.js";

export const agendaMethods = {
  // El calendario suscribible necesita el servidor (una URL que Google/Apple lean); en modo demo no existe.
  async createAgendaFeedToken() {
    throw new Error("agendaFeed:demo");
  },

  async getAgendaFeedToken() {
    return null;
  },

  // Visitas de prospectos a una propiedad (modo demo: sin RLS, se ven todas —
  // igual que la agenda, el modo demo resuelve advisorId a null).
  async getVisits({ propertyId } = {}) {
    return readStore(KEYS.visits, VISITS_SEED)
      .filter((v) => !propertyId || v.property_id === propertyId)
      .sort((a, b) => String(b.visited_at).localeCompare(String(a.visited_at)));
  },

  async getVisitById(id) {
    return readStore(KEYS.visits, VISITS_SEED).find((v) => v.id === id) || null;
  },

  async addVisit(fields) {
    const items = readStore(KEYS.visits, VISITS_SEED);
    if (fields.id && items.some((v) => v.id === fields.id)) throw duplicateKeyError();
    const now = new Date().toISOString();
    const record = { id: uid("visit"), ...fields, created_by: DEMO_ADMIN.email, created_at: now, updated_at: now };
    items.push(record);
    writeStore(KEYS.visits, items);
    return record;
  },

  async updateVisit(id, fields) {
    const items = readStore(KEYS.visits, VISITS_SEED);
    const idx = items.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error("Visita no encontrada");
    items[idx] = { ...items[idx], ...fields, updated_at: new Date().toISOString() };
    writeStore(KEYS.visits, items);
    return items[idx];
  },

  async deleteVisit(id) {
    writeStore(KEYS.visits, readStore(KEYS.visits, VISITS_SEED).filter((v) => v.id !== id));
  },

  // Espejo de next_visit_slots: el primer horario libre de cada propiedad (las que no tienen, no salen).
  async getNextVisitSlots(propertyIds) {
    const result = [];
    for (const id of [...new Set(propertyIds || [])].slice(0, 48)) {
      const [first] = await this.getVisitSlots(id, { days: 7 });
      if (first) result.push({ property_id: id, fecha: first.fecha, hora: first.hora });
    }
    return result;
  },

  async getVisitReport(propertyId) {
    return this._visitReportPayload(propertyId);
  },

  async getReportLink(propertyId) {
    return readStore(KEYS.reportLinks, []).find((l) => l.property_id === propertyId) || null;
  },

  // Crea el enlace o lo REGENERA (el token anterior deja de funcionar).
  async saveReportLink(propertyId) {
    const links = readStore(KEYS.reportLinks, []);
    const record = { property_id: propertyId, token: generateReportToken(), created_by: DEMO_ADMIN.email, created_at: new Date().toISOString() };
    const idx = links.findIndex((l) => l.property_id === propertyId);
    if (idx === -1) links.push(record);
    else links[idx] = record;
    writeStore(KEYS.reportLinks, links);
    return record;
  },

  async deleteReportLink(propertyId) {
    writeStore(KEYS.reportLinks, readStore(KEYS.reportLinks, []).filter((l) => l.property_id !== propertyId));
  },

  // Igual que en Supabase: null si el token no existe, fue regenerado o se
  // desactivó (y ni siquiera se busca si no tiene el formato de un token).
  async getVisitReportByToken(token) {
    if (!REPORT_TOKEN_PATTERN.test(token || "")) return null;
    const link = readStore(KEYS.reportLinks, []).find((l) => l.token === token);
    return link ? this._visitReportPayload(link.property_id) : null;
  },

  async getAgendaCitas() {
    const citas = readStore(KEYS.agendaCitas, []);
    return [...citas].sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
  },

  async getAgendaCitaById(id) {
    const citas = readStore(KEYS.agendaCitas, []);
    return citas.find((c) => c.id === id) || null;
  },

  async addAgendaCita({ id, advisor_id, client_id, titulo, fecha, hora, actividades, lugar, contact_name, contact_phone, contact_email, property_id, prospecto_id }) {
    const citas = readStore(KEYS.agendaCitas, []);
    // Un id que ya existe (reenvío de la cola sin señal) se rechaza igual que Supabase (23505).
    if (id && citas.some((c) => c.id === id)) throw duplicateKeyError();
    const record = {
      id: id || uid("cita"),
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
      lugar: lugar?.trim() || null,
      contact_name: contact_name?.trim() || null,
      contact_phone: contact_phone?.trim() || null,
      contact_email: contact_email?.trim() || null,
      // La propiedad que se enseña y el prospecto del que sale la cita (opcionales).
      property_id: property_id || null,
      prospecto_id: prospecto_id || null,
      status: "confirmada",
      source: "admin",
      // Toda cita tiene su enlace /visita/<token> (en Supabase es el valor por omisión de la columna).
      booking_token: generateBookingToken(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    citas.push(record);
    writeStore(KEYS.agendaCitas, citas);
    return record;
  },

  async updateAgendaCita(id, { advisor_id, client_id, titulo, fecha, hora, actividades, lugar, contact_name, contact_phone, contact_email, property_id }) {
    const citas = readStore(KEYS.agendaCitas, []);
    const idx = citas.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Cita no encontrada");
    const before = citas[idx];
    citas[idx] = {
      ...citas[idx],
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
      ...(lugar !== undefined ? { lugar: lugar?.trim() || null } : {}),
      ...(contact_name !== undefined ? { contact_name: contact_name?.trim() || null } : {}),
      ...(contact_phone !== undefined ? { contact_phone: contact_phone?.trim() || null } : {}),
      ...(contact_email !== undefined ? { contact_email: contact_email?.trim() || null } : {}),
      ...(property_id !== undefined ? { property_id: property_id || null } : {}),
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.agendaCitas, citas);
    await this._syncCitaProspect(before, citas[idx]);
    return citas[idx];
  },

  async setAgendaCitaStatus(id, status, { reason } = {}) {
    if (!CITA_STATUSES.includes(status)) throw new Error("Estatus de cita no válido");
    const citas = readStore(KEYS.agendaCitas, []);
    const idx = citas.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Cita no encontrada");
    const before = citas[idx];
    const cancelling = status === "cancelada";
    citas[idx] = {
      ...citas[idx],
      status,
      cancelled_by: cancelling ? "asesor" : null,
      cancelled_reason: cancelling ? String(reason ?? "").trim().slice(0, 300) || null : null,
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.agendaCitas, citas);
    await this._syncCitaProspect(before, citas[idx]);
    return citas[idx];
  },

  async deleteAgendaCita(id) {
    const citas = readStore(KEYS.agendaCitas, []);
    writeStore(KEYS.agendaCitas, citas.filter((c) => c.id !== id));
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    writeStore(KEYS.agendaExpedientes, expedientes.filter((e) => e.cita_id !== id));
  },

  // ── Agendar visita con horarios reales (modo demo) ──
  // Mismo contrato que las funciones SQL de supabase/schema.sql, apoyado en
  // src/lib/visitSlots.js. Los horarios se guardan por asesor en un solo objeto:
  // { [advisorId]: { settings, weekly, timeOff } }.
  async getVisitSlots(propertyId, { from = null, days = 14 } = {}) {
    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === propertyId);
    if (!property || !property.active || property.status === "vendida") return [];
    const schedules = readStore(KEYS.visitSchedules, {});
    const citas = readStore(KEYS.agendaCitas, []);
    const advisors = readStore(KEYS.advisors, ADVISORS).filter((a) => a.active !== false && (property.advisor_ids || []).includes(a.id));
    const start = from || mexicoParts().date;
    const end = addDays(start, Math.min(Math.max(Number(days) || 14, 1), 60));
    return mergeSlots(
      advisors.map((a) => {
        const schedule = schedules[a.id];
        if (!schedule) return [];
        // Cada horario dice quién está libre a esa hora (nombre y foto, sin datos de contacto).
        const who = { id: a.id, name: a.name, photo_url: a.photo_url || null };
        return generateSlots({ settings: schedule.settings, availability: schedule.weekly, timeOff: schedule.timeOff, citas, advisorId: a.id, from: start, to: end }).map((slot) => ({ ...slot, advisors: [who] }));
      })
    );
  },

  async bookVisit({ propertyId, fecha, hora, name, email, phone, note }) {
    const invalid = validateBookingInput({ name, email, phone, note });
    if (invalid) return { error: invalid };
    if (!fecha || !hora) return { error: "invalid_slot" };

    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === propertyId);
    if (!property || !property.active || property.status === "vendida") return { error: "property_unavailable" };

    // Mismos límites que book_visit: 5 intentos por teléfono por hora, 2 visitas activas.
    const digits = phoneDigits(phone).slice(-10);
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const attempts = readStore(KEYS.visitAttempts, []).filter((a) => a.at > hourAgo);
    if (attempts.filter((a) => a.phone === digits).length >= 5) return { error: "rate_limited" };
    writeStore(KEYS.visitAttempts, [...attempts, { phone: digits, at: Date.now() }]);

    const citas = readStore(KEYS.agendaCitas, []);
    if (activeBookingsForPhone(citas, phone) >= MAX_ACTIVE_BOOKINGS_PER_PHONE) return { error: "too_many_active" };

    const schedules = readStore(KEYS.visitSchedules, {});
    const advisors = readStore(KEYS.advisors, ADVISORS).filter((a) => a.active !== false && (property.advisor_ids || []).includes(a.id));
    const free = advisors.filter((a) => {
      const schedule = schedules[a.id];
      if (!schedule) return false;
      return generateSlots({ settings: schedule.settings, availability: schedule.weekly, timeOff: schedule.timeOff, citas, advisorId: a.id, from: fecha, to: fecha }).some((slot) => slot.hora === hhmm(hora));
    });
    const chosenId = pickAdvisor(free.map((a) => a.id), citas, fecha);
    if (!chosenId) return { error: "slot_unavailable" };
    const advisor = advisors.find((a) => a.id === chosenId);

    const title = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
    const messages = readStore(KEYS.messages, []);
    const message = {
      id: uid("msg"),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: buildBookingMessage({ title: property.title, code: property.code, fecha, hora, note }),
      property_id: propertyId,
      channel: "visita",
      details: { fecha, hora: hhmm(hora), advisor_id: chosenId },
      status: "nuevo",
      created_at: new Date().toISOString(),
    };
    writeStore(KEYS.messages, [...messages, message]);

    // Quien reserva ya es un prospecto (mismas reglas que visit_promote_prospect en SQL).
    const prospectId = await this._promoteBookingProspect({ property, advisorId: chosenId, name: name.trim(), phone: phone.trim(), email: email.trim(), fecha, hora: hhmm(hora), messageId: message.id, note });

    const now = new Date().toISOString();
    const cita = {
      id: uid("cita"),
      advisor_id: chosenId,
      client_id: null,
      property_id: propertyId,
      titulo: `Visita: ${title}`,
      fecha,
      hora: hhmm(hora),
      duracion_min: schedules[chosenId].settings.slot_minutes,
      actividades: note?.trim() || null,
      lugar: property.address || null,
      status: "confirmada",
      source: "sitio",
      booking_token: generateBookingToken(),
      contact_name: name.trim(),
      contact_phone: phone.trim(),
      contact_email: email.trim(),
      message_id: message.id,
      prospecto_id: prospectId,
      reschedule_count: 0,
      client_confirmed_at: null,
      cancelled_reason: null,
      cancelled_by: null,
      created_at: now,
      updated_at: now,
    };
    writeStore(KEYS.agendaCitas, [...citas, cita]);

    return {
      ok: true,
      token: cita.booking_token,
      fecha: cita.fecha,
      hora: cita.hora,
      duracion_min: cita.duracion_min,
      advisor: { id: advisor.id, name: advisor.name, phone: advisor.phone, whatsapp: advisor.whatsapp, photo_url: advisor.photo_url },
      property: { id: property.id, title: property.title, code: property.code, address: property.address },
    };
  },

  // Solicitud de visita sin asesor (mismas reglas que request_visit en SQL): queda en la Agenda de todos
  // hasta que alguien la toma con claimVisitRequest.
  async requestVisit({ propertyId, fecha, hora, name, email, phone, note }) {
    const invalid = validateBookingInput({ name, email, phone, note });
    if (invalid) return { error: invalid };
    if (requestSlotError(fecha, hora)) return { error: "invalid_slot" };

    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === propertyId);
    if (!property || !property.active || property.status === "vendida") return { error: "property_unavailable" };

    const digits = phoneDigits(phone).slice(-10);
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const attempts = readStore(KEYS.visitAttempts, []).filter((a) => a.at > hourAgo);
    if (attempts.filter((a) => a.phone === digits).length >= 5) return { error: "rate_limited" };
    writeStore(KEYS.visitAttempts, [...attempts, { phone: digits, at: Date.now() }]);

    const citas = readStore(KEYS.agendaCitas, []);
    if (activeBookingsForPhone(citas, phone) >= MAX_ACTIVE_BOOKINGS_PER_PHONE) return { error: "too_many_active" };

    const title = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
    const message = {
      id: uid("msg"),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: buildRequestMessage({ title: property.title, code: property.code, fecha, hora, note }),
      property_id: propertyId,
      channel: "visita_solicitud",
      details: { fecha, hora: hhmm(hora), sin_asesor: true },
      status: "nuevo",
      created_at: new Date().toISOString(),
    };
    writeStore(KEYS.messages, [...readStore(KEYS.messages, []), message]);

    const prospectId = await this._promoteBookingProspect({ property, advisorId: null, name: name.trim(), phone: phone.trim(), email: email.trim(), fecha, hora: hhmm(hora), messageId: message.id, note, requested: true });

    const now = new Date().toISOString();
    const cita = {
      id: uid("cita"),
      advisor_id: null,
      client_id: null,
      property_id: propertyId,
      titulo: `Visita: ${title}`,
      fecha,
      hora: hhmm(hora),
      duracion_min: 60,
      actividades: note?.trim() || null,
      lugar: property.address || null,
      status: "solicitada",
      source: "sitio",
      booking_token: generateBookingToken(),
      contact_name: name.trim(),
      contact_phone: phone.trim(),
      contact_email: email.trim(),
      message_id: message.id,
      prospecto_id: prospectId,
      reschedule_count: 0,
      client_confirmed_at: null,
      cancelled_reason: null,
      cancelled_by: null,
      created_at: now,
      updated_at: now,
    };
    writeStore(KEYS.agendaCitas, [...citas, cita]);
    return { ok: true, token: cita.booking_token, fecha: cita.fecha, hora: cita.hora, property: { id: property.id, title: property.title, code: property.code, address: property.address } };
  },

  // Tomar una solicitud sin asesor (claim_visit_request en SQL): la primera persona se la queda y la cita
  // queda confirmada con su nombre; quien llega después recibe already_taken.
  async claimVisitRequest(citaId, { advisorId = null } = {}) {
    if (!advisorId) return { error: "advisor_required" };
    const advisor = readStore(KEYS.advisors, ADVISORS).find((a) => a.id === advisorId && a.active !== false);
    if (!advisor) return { error: "invalid_advisor" };
    const citas = readStore(KEYS.agendaCitas, []);
    const idx = citas.findIndex((c) => c.id === citaId);
    if (idx === -1) return { error: "not_found" };
    const cita = citas[idx];
    if ((cita.status || "confirmada") !== "solicitada" || cita.advisor_id) return { error: "already_taken" };
    const minutes = readStore(KEYS.visitSchedules, {})[advisorId]?.settings?.slot_minutes;
    citas[idx] = { ...cita, advisor_id: advisorId, status: "confirmada", duracion_min: minutes || cita.duracion_min, updated_at: new Date().toISOString() };
    writeStore(KEYS.agendaCitas, citas);
    if (cita.prospecto_id) {
      const prospect = readStore(KEYS.prospects, []).find((p) => p.id === cita.prospecto_id);
      if (prospect && !prospect.advisor_id) await this.updateProspect(prospect.id, { advisor_id: advisorId });
    }
    return { ok: true, cita_id: citaId, advisor_id: advisorId };
  },

  // Espejo de get_visit_survey / submit_visit_feedback (schema.sql): mismos estados y mismos errores.
  async getVisitSurvey(token) {
    if (!BOOKING_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const cita = readStore(KEYS.agendaCitas, []).find((c) => c.booking_token === token);
    if (!cita) return { status: "invalido" };
    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === cita.property_id);
    const answered = readStore(KEYS.visitFeedback, []).some((f) => f.cita_id === cita.id);
    return {
      status: answered ? "respondida" : cita.status === "realizada" ? "ok" : "no_disponible",
      fecha: cita.fecha,
      property: property ? { title: property.title, code: property.code || null } : null,
    };
  },

  async submitVisitFeedback(token, rating, comment = null) {
    if (!BOOKING_TOKEN_PATTERN.test(token || "")) return { error: "invalid" };
    const cita = readStore(KEYS.agendaCitas, []).find((c) => c.booking_token === token);
    if (!cita) return { error: "invalid" };
    if (cita.status !== "realizada") return { error: "not_ready" };
    const value = Number(rating);
    if (!Number.isInteger(value) || value < 1 || value > 5) return { error: "invalid_rating" };
    const cleaned = String(comment ?? "").trim();
    if (cleaned.length > 500) return { error: "invalid_comment" };
    const all = readStore(KEYS.visitFeedback, []);
    if (all.some((f) => f.cita_id === cita.id)) return { error: "already_answered" };
    all.push({ id: uid("fb"), cita_id: cita.id, property_id: cita.property_id || null, advisor_id: cita.advisor_id || null, rating: value, comment: cleaned || null, created_at: new Date().toISOString() });
    writeStore(KEYS.visitFeedback, all);
    return { ok: true };
  },

  async getVisitFeedback() {
    return readStore(KEYS.visitFeedback, []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async getVisitBooking(token) {
    if (!BOOKING_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const cita = readStore(KEYS.agendaCitas, []).find((c) => c.booking_token === token);
    if (!cita) return { status: "invalido" };
    const advisor = readStore(KEYS.advisors, ADVISORS).find((a) => a.id === cita.advisor_id);
    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === cita.property_id);
    const { canReschedule, canCancel, canConfirm } = bookingPermissions(cita);
    // Una cita que capturó el equipo también tiene enlace: el nombre sale del cliente ligado, y solo se
    // puede mover si su asesor ofrece horarios en línea (las del sitio siempre; mismo criterio que get_booking).
    const linkedClient = cita.client_id ? readStore(KEYS.clients, []).find((c) => c.id === cita.client_id) : null;
    const advisorOffersSlots = Boolean(readStore(KEYS.visitSchedules, {})[cita.advisor_id]?.settings?.enabled);
    return {
      status: cita.status || "confirmada",
      fecha: cita.fecha,
      hora: cita.hora,
      duracion_min: cita.duracion_min,
      client_name: String(cita.contact_name?.trim() || linkedClient?.name || "").split(" ")[0],
      titulo: cita.titulo,
      lugar: cita.lugar || null,
      client_confirmed_at: cita.client_confirmed_at,
      reschedule_count: cita.reschedule_count,
      can_reschedule: canReschedule && (cita.source === "sitio" || advisorOffersSlots),
      can_cancel: canCancel,
      can_confirm: canConfirm,
      advisor: advisor ? { id: advisor.id, name: advisor.name, phone: advisor.phone, whatsapp: advisor.whatsapp, photo_url: advisor.photo_url } : null,
      property: property ? { id: property.id, title: property.title, code: property.code, address: property.address, main_image: property.main_image, lat: property.lat, lng: property.lng } : null,
    };
  },

  async getBookingSlots(token, { days = 14 } = {}) {
    const citas = readStore(KEYS.agendaCitas, []);
    const cita = BOOKING_TOKEN_PATTERN.test(token || "") ? citas.find((c) => c.booking_token === token) : null;
    if (!cita || (cita.status || "confirmada") !== "confirmada") return [];
    const schedule = readStore(KEYS.visitSchedules, {})[cita.advisor_id];
    if (!schedule) return [];
    const today = mexicoParts().date;
    return generateSlots({
      settings: schedule.settings,
      availability: schedule.weekly,
      timeOff: schedule.timeOff,
      citas,
      advisorId: cita.advisor_id,
      from: today,
      to: addDays(today, Math.min(Math.max(Number(days) || 14, 1), 60)),
      excludeCitaId: cita.id,
    });
  },

  // Prospecto de quien reserva una visita: se crea (interesado, con seguimiento el día después de la
  // visita) o, si ya hay uno abierto con ese teléfono o correo, se actualiza en vez de duplicarlo.
  async _promoteBookingProspect({ property, advisorId, name, phone, email, fecha, hora, messageId, note, requested = false }) {
    const label = property.code ? `${property.title.trim()} (${property.code})` : property.title.trim();
    const nowISO = new Date().toISOString();
    const today = mexicoParts().date;
    const existing = findOpenProspect(readStore(KEYS.prospects, []), { phone, email });
    if (existing) {
      await this.updateProspect(existing.id, mergeBookingIntoProspect(existing, { propertyId: property.id, label, fecha, hora, note, today, nowISO, requested }));
      return existing.id;
    }
    const created = await this.addProspect(prospectFieldsFromBooking({ name, phone, email, advisorId, propertyId: property.id, messageId, label, fecha, hora, note, nowISO, requested }));
    return created.id;
  },

  // Aviso al asesor (inbox de Mensajes) cuando el cliente mueve o cancela su visita.
  _pushVisitChange(cita, kind, extra) {
    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === cita.property_id);
    const messages = readStore(KEYS.messages, []);
    const linkedClient = cita.client_id ? readStore(KEYS.clients, []).find((c) => c.id === cita.client_id) : null;
    messages.push({
      id: uid("msg"),
      name: cita.contact_name || linkedClient?.name || "(sin nombre)",
      email: cita.contact_email || linkedClient?.email || "",
      phone: cita.contact_phone || linkedClient?.phone || null,
      message: buildBookingChangeMessage({ kind, title: property?.title || cita.titulo, code: property?.code, ...extra }),
      property_id: cita.property_id ?? null,
      channel: "visita_cambio",
      details: { cita_id: cita.id, kind, advisor_id: cita.advisor_id },
      status: "nuevo",
      created_at: new Date().toISOString(),
    });
    writeStore(KEYS.messages, messages);
  },

  async rescheduleVisitBooking(token, fecha, hora) {
    const citas = readStore(KEYS.agendaCitas, []);
    const idx = BOOKING_TOKEN_PATTERN.test(token || "") ? citas.findIndex((c) => c.booking_token === token) : -1;
    if (idx === -1) return { error: "not_found" };
    const cita = citas[idx];
    if ((cita.status || "confirmada") !== "confirmada" || !cita.hora) return { error: "not_active" };
    const { canReschedule } = bookingPermissions(cita);
    if (!canReschedule) return { error: (cita.reschedule_count || 0) >= MAX_RESCHEDULES ? "limit_reached" : "too_late" };

    const schedule = readStore(KEYS.visitSchedules, {})[cita.advisor_id];
    const free = schedule && fecha && hora
      ? generateSlots({ settings: schedule.settings, availability: schedule.weekly, timeOff: schedule.timeOff, citas, advisorId: cita.advisor_id, from: fecha, to: fecha, excludeCitaId: cita.id }).some((slot) => slot.hora === hhmm(hora))
      : false;
    if (!free) return { error: "slot_unavailable" };

    citas[idx] = { ...cita, fecha, hora: hhmm(hora), reschedule_count: (cita.reschedule_count || 0) + 1, client_confirmed_at: null, reminder_sent_at: null, client_reminder_sent_at: null, updated_at: new Date().toISOString() };
    writeStore(KEYS.agendaCitas, citas);
    this._pushVisitChange(citas[idx], "reprogramada", { oldFecha: cita.fecha, oldHora: cita.hora, fecha, hora: hhmm(hora) });
    await this._syncCitaProspect(cita, citas[idx]);
    return { ok: true, fecha, hora: hhmm(hora), reschedule_count: citas[idx].reschedule_count };
  },

  async cancelVisitBooking(token, reason) {
    const citas = readStore(KEYS.agendaCitas, []);
    const idx = BOOKING_TOKEN_PATTERN.test(token || "") ? citas.findIndex((c) => c.booking_token === token) : -1;
    if (idx === -1) return { error: "not_found" };
    if (!["confirmada", "solicitada"].includes(citas[idx].status || "confirmada")) return { error: "not_active" };
    if (!bookingPermissions(citas[idx]).canCancel) return { error: "too_late" };
    const statusBefore = citas[idx].status || "confirmada";
    citas[idx] = { ...citas[idx], status: "cancelada", cancelled_by: "cliente", cancelled_reason: String(reason ?? "").trim().slice(0, 300) || null, updated_at: new Date().toISOString() };
    writeStore(KEYS.agendaCitas, citas);
    this._pushVisitChange(citas[idx], "cancelada", { oldFecha: citas[idx].fecha, oldHora: citas[idx].hora, reason });
    await this._syncCitaProspect({ ...citas[idx], status: statusBefore }, citas[idx]);
    return { ok: true };
  },

  async confirmVisitAttendance(token) {
    const citas = readStore(KEYS.agendaCitas, []);
    const idx = BOOKING_TOKEN_PATTERN.test(token || "") ? citas.findIndex((c) => c.booking_token === token) : -1;
    if (idx === -1) return { error: "not_found" };
    if ((citas[idx].status || "confirmada") !== "confirmada") return { error: "not_active" };
    if (!bookingPermissions(citas[idx]).canCancel) return { error: "too_late" };
    citas[idx] = { ...citas[idx], client_confirmed_at: citas[idx].client_confirmed_at || new Date().toISOString(), updated_at: new Date().toISOString() };
    writeStore(KEYS.agendaCitas, citas);
    return { ok: true };
  },

  async getAdvisorVisitSchedule(advisorId) {
    const saved = readStore(KEYS.visitSchedules, {})[advisorId];
    return saved || { settings: { ...DEFAULT_VISIT_SETTINGS, enabled: false }, weekly: [], timeOff: [] };
  },

  async saveAdvisorVisitSchedule(advisorId, input) {
    const schedules = readStore(KEYS.visitSchedules, {});
    const normalized = normalizeVisitSchedule(input);
    schedules[advisorId] = { ...normalized, timeOff: normalized.timeOff.map((o) => ({ id: uid("off"), ...o })) };
    writeStore(KEYS.visitSchedules, schedules);
    return schedules[advisorId];
  },

  async getAgendaExpedientes(citaId) {
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    return expedientes
      .filter((e) => e.cita_id === citaId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((e) => ({ ...e, signed_url: e.file_path }));
  },

  async addAgendaExpediente({ cita_id, file }) {
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    const [dataUrl] = await filesToDataUrls([file]);
    const record = { id: uid("expediente"), cita_id, file_path: dataUrl, file_name: file.name, created_at: new Date().toISOString() };
    expedientes.push(record);
    writeStore(KEYS.agendaExpedientes, expedientes);
    return record;
  },

  async deleteAgendaExpediente(id) {
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    writeStore(KEYS.agendaExpedientes, expedientes.filter((e) => e.id !== id));
  },
};
