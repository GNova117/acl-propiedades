// Backend con Supabase: métodos de «admin» (31). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { slugify } from "../../format";

export const adminMethods = {
  mode: "supabase",

  // Registro de actividad (quién creó/editó/borró qué). Solo lo ve el rol con el
  // apartado 'roles'; lo escriben triggers de la base (ver schema.sql).
  async getAuditLog({ table, actor, from, to, limit = 100, offset = 0 } = {}) {
    let query = supabase.from("audit_log").select("*").order("at", { ascending: false }).range(offset, offset + limit - 1);
    if (table) query = query.eq("table_name", table);
    if (actor) query = query.ilike("actor", `%${actor.replace(/[%_]/g, "")}%`);
    if (from) query = query.gte("at", `${from}T00:00:00`);
    if (to) query = query.lte("at", `${to}T23:59:59`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getRoles() {
    const { data, error } = await supabase.from("admin_roles").select("*").order("name");
    if (error) throw error;
    return data || [];
  },

  async addRole({ name, sections }) {
    const trimmed = name.trim();
    const payload = { slug: slugify(trimmed), name: trimmed, sections: sections || [] };
    const { data, error } = await supabase.from("admin_roles").insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateRole(id, { name, sections }) {
    // El slug se recalcula con el nombre: si quedara el viejo, crear después un
    // rol con el nombre original chocaría con el slug único de este.
    const trimmed = name.trim();
    const payload = { slug: slugify(trimmed), name: trimmed, sections: sections || [] };
    const { data, error } = await supabase.from("admin_roles").update(payload).eq("id", id).select().single();
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe un rol con ese nombre");
      throw error;
    }
    return data;
  },

  async deleteRole(id) {
    const { error } = await supabase.from("admin_roles").delete().eq("id", id);
    if (error) throw error;
  },

  async getAccess() {
    const { data, error } = await supabase
      .from("admin_access")
      .select("*, role:admin_roles(*)")
      .order("email");
    if (error) throw error;
    return data || [];
  },

  async getMyAccess(email) {
    const { data, error } = await supabase
      .from("admin_access")
      .select("*, role:admin_roles(*)")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async addAccess({ email, role_id, advisor_id }) {
    const payload = { email: email.trim().toLowerCase(), role_id, advisor_id: advisor_id || null };
    const { data, error } = await supabase
      .from("admin_access")
      .insert(payload)
      .select("*, role:admin_roles(*)")
      .single();
    if (error) throw error;
    return data;
  },

  // Manda la invitación por correo (Edge Function invitar-usuario) a alguien que YA tiene acceso en Roles: el enlace le
  // deja elegir su contraseña en /admin/restablecer. Devuelve { alreadyHasAccount }. Lanza `invite:<motivo>`.
  async inviteUser(email) {
    const { data, error } = await supabase.functions.invoke("invitar-usuario", { body: { email } });
    if (error) {
      let reason = "failed";
      try {
        reason = (await error.context?.json?.())?.error || reason;
      } catch {
        /* sin cuerpo legible */
      }
      throw new Error(`invite:${reason}`);
    }
    return { alreadyHasAccount: Boolean(data?.alreadyHasAccount) };
  },

  async updateAccess(id, { role_id, advisor_id } = {}) {
    const payload = {};
    if (role_id !== undefined) payload.role_id = role_id;
    if (advisor_id !== undefined) payload.advisor_id = advisor_id || null;
    const { data, error } = await supabase
      .from("admin_access")
      .update(payload)
      .eq("id", id)
      .select("*, role:admin_roles(*)")
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAccess(id) {
    const { error } = await supabase.from("admin_access").delete().eq("id", id);
    if (error) throw error;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },

  // «Olvidé mi contraseña»: Supabase manda el enlace al correo (si existe; la respuesta es la misma exista o no, para no
  // revelar qué correos tienen cuenta). El enlace abre /admin/restablecer con una sesión de recuperación.
  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: `${window.location.origin}/admin/restablecer` });
    if (error) throw error;
  },

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  // ── Verificación en dos pasos (TOTP de Supabase Auth) y dispositivos ──
  // → { enrolled, factors: [{ id, name, createdAt }], needsCode, factorId }. `needsCode`: la sesión solo tiene la contraseña
  // y la cuenta tiene la verificación activada, así que falta confirmar el código antes de entrar al panel.
  async getMfaStatus() {
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    const { data: list, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    const verified = list?.totp || [];
    return {
      enrolled: verified.length > 0,
      factors: verified.map((f) => ({ id: f.id, name: f.friendly_name || "", createdAt: f.created_at })),
      needsCode: aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2",
      factorId: verified[0]?.id || null,
    };
  },

  // Empieza a activarla: → { factorId, secret, uri, qrSvg }. Se confirma con verifyMfa (el primer código correcto la activa).
  async enrollMfa() {
    // Un intento anterior sin terminar deja un factor «unverified» que estorba (mismo nombre): se limpia primero.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const factor of list?.all || []) {
      if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Autenticador ${new Date().toISOString().slice(0, 16)}` });
    if (error) throw error;
    return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri, qrSvg: data.totp.qr_code };
  },

  // Confirma un código de 6 dígitos (al activarla y al iniciar sesión). Lanza si es incorrecto.
  async verifyMfa(factorId, code) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: String(code || "").replace(/\s/g, "") });
    if (error) throw error;
    return true;
  },

  async removeMfa(factorId) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  },

  // Dispositivos que han entrado al panel (tabla admin_devices; ver «Verificación en dos pasos y dispositivos»).
  async touchDevice(deviceId, label) {
    const { error } = await supabase.rpc("touch_admin_device", { p_device_id: deviceId, p_label: label });
    if (error) throw error;
  },

  async listDevices() {
    const { data, error } = await supabase.from("admin_devices").select("device_id, label, first_seen, last_seen").order("last_seen", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Cierra la sesión en todos los demás dispositivos (real: invalida sus tokens) y los quita de la lista.
  async signOutOtherDevices(currentDeviceId) {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) throw error;
    const { error: forgetError } = await supabase.rpc("forget_other_admin_devices", { p_device_id: currentDeviceId });
    if (forgetError) throw forgetError;
  },

  // ── Monitoreo de errores del navegador (tabla client_errors; ver «Monitoreo de errores» en schema.sql) ──
  async reportClientError(payload) {
    const { error } = await supabase.rpc("report_client_error", {
      p_fingerprint: payload.fingerprint,
      p_message: payload.message,
      p_stack: payload.stack || null,
      p_url: payload.url || null,
      p_user_agent: payload.user_agent || null,
      p_release: payload.release || null,
      p_source: payload.source || "window",
    });
    if (error) throw error;
  },

  async getClientErrors() {
    const { data, error } = await supabase.from("client_errors").select("*").order("last_seen", { ascending: false }).limit(300);
    if (error) throw error;
    return data || [];
  },

  async setClientErrorStatus(id, status) {
    const { error } = await supabase.from("client_errors").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async deleteClientError(id) {
    const { error } = await supabase.from("client_errors").delete().eq("id", id);
    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    // Sin señal el cierre en el servidor falla y la sesión seguiría guardada: se cierra al menos en este dispositivo.
    if (error) await supabase.auth.signOut({ scope: "local" });
  },

  // Sin sesión guardada devuelve null. Si la guardada caducó y no se pudo renovar por falta de red, NO es lo mismo que no
  // haber iniciado sesión: se rechaza con un error de red (isOfflineError) para que el panel pueda abrir sin señal.
  async getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();
    if (!data.session && error?.name === "AuthRetryableFetchError") {
      throw Object.assign(new Error("network request failed"), { cause: error });
    }
    return data.session;
  },

  // El callback recibe (sesión, evento): el evento distingue, p. ej., INITIAL_SESSION de SIGNED_OUT.
  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
    return () => data.subscription.unsubscribe();
  },

  // Notificaciones push del navegador/SO (ver schema.sql: push_subscriptions,
  // Edge Function enviar-push). `endpoint` es único por dispositivo/navegador
  // — upsert por endpoint para que volver a activar en el mismo dispositivo
  // actualice la fila en vez de duplicarla.
  async savePushSubscription({ email, endpoint, p256dh, auth, userAgent }) {
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ email, endpoint, p256dh, auth, user_agent: userAgent || null }, { onConflict: "endpoint" });
    if (error) throw error;
  },

  async deletePushSubscription(endpoint) {
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw error;
  },
};
