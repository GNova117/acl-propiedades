// Backend de modo demo (localStorage): métodos de «admin» (32). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { generateSecret, otpauthUri, verifyTotp } from "../../totp";
import { DEMO_ADMIN, ADMIN_ROLES_SEED, ADMIN_ACCESS_SEED } from "../../seedData";
import { slugify } from "../../format";
import { MFA_OK_KEY, KEYS, readStore, writeStore, uid, authListeners, getSession, notifyAuthListeners } from "./shared.js";

export const adminMethods = {
  mode: "local",

  // La depuración de papelería vive en la base (migración 0123): el modo demostración no la tiene.
  async getRetentionSummary() {
    return null;
  },

  // Registro de actividad: en modo demo no hay base ni triggers, así que no hay registro.
  async getAuditLog() {
    return [];
  },

  async getRoles() {
    return readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
  },

  async addRole({ name, sections }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (roles.some((r) => r.slug === slug)) {
      throw new Error("Ya existe un rol con ese nombre");
    }
    const record = { id: uid("role"), slug, name: trimmed, sections: sections || [] };
    roles.push(record);
    writeStore(KEYS.adminRoles, roles);
    return record;
  },

  async updateRole(id, { name, sections }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const idx = roles.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Rol no encontrado");
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (roles.some((r) => r.id !== id && r.slug === slug)) throw new Error("Ya existe un rol con ese nombre");
    roles[idx] = { ...roles[idx], slug, name: trimmed, sections: sections || [] };
    writeStore(KEYS.adminRoles, roles);
    return roles[idx];
  },

  async deleteRole(id) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    if (access.some((a) => a.role_id === id)) {
      throw new Error("Este rol tiene correos asignados; quítales el acceso antes de borrarlo");
    }
    writeStore(KEYS.adminRoles, roles.filter((r) => r.id !== id));
  },

  async getAccess() {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    return access.map((a) => ({ ...a, role: roles.find((r) => r.id === a.role_id) || null }));
  },

  async getMyAccess(email) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const found = access.find((a) => a.email === email.toLowerCase());
    if (!found) return null;
    return { ...found, role: roles.find((r) => r.id === found.role_id) || null };
  },

  async addAccess({ email, role_id, advisor_id }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const normalized = email.trim().toLowerCase();
    if (access.some((a) => a.email === normalized)) {
      throw new Error("Ese correo ya tiene acceso asignado");
    }
    const record = { id: uid("access"), email: normalized, role_id, advisor_id: advisor_id || null };
    access.push(record);
    writeStore(KEYS.adminAccess, access);
    return { ...record, role: roles.find((r) => r.id === role_id) || null };
  },

  async inviteUser() {
    throw new Error("invite:demo");
  },

  async updateAccess(id, { role_id, advisor_id } = {}) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const idx = access.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Acceso no encontrado");
    const patch = {};
    if (role_id !== undefined) patch.role_id = role_id;
    if (advisor_id !== undefined) patch.advisor_id = advisor_id || null;
    access[idx] = { ...access[idx], ...patch };
    writeStore(KEYS.adminAccess, access);
    return { ...access[idx], role: roles.find((r) => r.id === access[idx].role_id) || null };
  },

  async deleteAccess(id) {
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    writeStore(KEYS.adminAccess, access.filter((a) => a.id !== id));
  },

  async signIn(email, password) {
    if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
      const session = { user: { email } };
      writeStore(KEYS.session, session);
      try {
        window.sessionStorage.removeItem(MFA_OK_KEY); // cada inicio de sesión vuelve a pedir el código
      } catch {
        /* sin sessionStorage */
      }
      notifyAuthListeners();
      return session;
    }
    throw new Error("invalid_credentials");
  },

  // En modo demo no hay correo ni cuentas reales: la pantalla lo avisa.
  async requestPasswordReset() {
    throw new Error("passwordReset:demo");
  },

  async updatePassword() {
    throw new Error("passwordReset:demo");
  },

  async signOut() {
    window.localStorage.removeItem(KEYS.session);
    try {
      window.sessionStorage.removeItem(MFA_OK_KEY);
    } catch {
      /* sin sessionStorage */
    }
    notifyAuthListeners();
  },

  // ── Monitoreo de errores (demo): se agrupan por huella igual que en la base ──
  async reportClientError(payload) {
    const errors = readStore(KEYS.clientErrors, []);
    const now = new Date().toISOString();
    const known = errors.find((e) => e.fingerprint === payload.fingerprint);
    if (known) {
      Object.assign(known, { count: known.count + 1, last_seen: now, url: payload.url, release: payload.release, status: known.status === "resuelto" ? "nuevo" : known.status });
    } else {
      errors.push({ id: uid("error"), ...payload, count: 1, status: "nuevo", first_seen: now, last_seen: now, notified_at: null });
    }
    writeStore(KEYS.clientErrors, errors);
  },

  async reportUserProblem({ message, url, userAgent, release }) {
    const text = String(message || "").trim().slice(0, 1000);
    if (text.length < 10) throw Object.assign(new Error("Texto demasiado corto"), { code: "too_short" });
    const who = getSession()?.user?.email;
    if (!who) throw new Error("Inicia sesión para reportar un problema");
    const errors = readStore(KEYS.clientErrors, []);
    const mine = errors.filter((e) => e.source === "usuario" && e.reported_by === who && Date.now() - new Date(e.first_seen).getTime() < 3600_000);
    if (mine.length >= 10) throw Object.assign(new Error("Demasiados reportes"), { code: "rate_limited" });
    const now = new Date().toISOString();
    errors.push({ id: uid("error"), fingerprint: uid("rep"), message: text, stack: "", source: "usuario", url: url || "", user_agent: userAgent || "", release: release || "", reported_by: who, count: 1, status: "nuevo", first_seen: now, last_seen: now, notified_at: null });
    writeStore(KEYS.clientErrors, errors);
  },

  async getClientErrors() {
    return [...readStore(KEYS.clientErrors, [])].sort((a, b) => String(b.last_seen).localeCompare(String(a.last_seen)));
  },

  async setClientErrorStatus(id, status) {
    writeStore(KEYS.clientErrors, readStore(KEYS.clientErrors, []).map((e) => (e.id === id ? { ...e, status } : e)));
  },

  async deleteClientError(id) {
    writeStore(KEYS.clientErrors, readStore(KEYS.clientErrors, []).filter((e) => e.id !== id));
  },

  // ── Verificación en dos pasos (demo): mismo recorrido que en Supabase, con un TOTP real guardado en este navegador ──
  async getMfaStatus() {
    const factors = readStore(KEYS.mfa, []).filter((f) => f.verified);
    let confirmed = false;
    try {
      confirmed = window.sessionStorage.getItem(MFA_OK_KEY) === "1";
    } catch {
      /* sin sessionStorage */
    }
    return {
      enrolled: factors.length > 0,
      factors: factors.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt })),
      needsCode: factors.length > 0 && !confirmed,
      factorId: factors[0]?.id || null,
    };
  },

  async enrollMfa() {
    const secret = generateSecret();
    const factor = { id: uid("mfa"), secret, verified: false, name: "Autenticador (demo)", createdAt: new Date().toISOString() };
    writeStore(KEYS.mfa, [...readStore(KEYS.mfa, []).filter((f) => f.verified), factor]);
    const email = getSession()?.user?.email || "demo";
    return { factorId: factor.id, secret, uri: otpauthUri(secret, email), qrSvg: null };
  },

  async verifyMfa(factorId, code) {
    const factors = readStore(KEYS.mfa, []);
    const factor = factors.find((f) => f.id === factorId);
    if (!factor || !(await verifyTotp(factor.secret, code))) throw new Error("invalid_mfa_code");
    writeStore(KEYS.mfa, factors.map((f) => (f.id === factorId ? { ...f, verified: true } : f)));
    try {
      window.sessionStorage.setItem(MFA_OK_KEY, "1");
    } catch {
      /* sin sessionStorage */
    }
    return true;
  },

  async removeMfa(factorId) {
    writeStore(KEYS.mfa, readStore(KEYS.mfa, []).filter((f) => f.id !== factorId));
  },

  // Dispositivos (demo): solo este navegador, para poder ver la pantalla.
  async touchDevice(deviceId, label) {
    const now = new Date().toISOString();
    const devices = readStore(KEYS.devices, []);
    const known = devices.find((d) => d.device_id === deviceId);
    writeStore(KEYS.devices, known ? devices.map((d) => (d.device_id === deviceId ? { ...d, label, last_seen: now } : d)) : [...devices, { device_id: deviceId, label, first_seen: now, last_seen: now }]);
  },

  async listDevices() {
    return [...readStore(KEYS.devices, [])].sort((a, b) => String(b.last_seen).localeCompare(String(a.last_seen)));
  },

  async signOutOtherDevices(currentDeviceId) {
    writeStore(KEYS.devices, readStore(KEYS.devices, []).filter((d) => d.device_id === currentDeviceId));
  },

  getCurrentSession() {
    return getSession();
  },

  onAuthStateChange(callback) {
    authListeners.add(callback);
    return () => authListeners.delete(callback);
  },

  // Notificaciones push: la suscripción en sí es una operación del propio
  // navegador (Service Worker + Push API, ver lib/pushNotifications.js) que
  // funciona igual en demo, pero guardarla no sirve de nada sin el backend
  // real que de verdad manda el push (Edge Function enviar-push con la
  // service role key) — no vale la pena simularlo sobre localStorage.
  async savePushSubscription() {
    throw new Error("Las notificaciones push no están disponibles en modo demo (requieren Supabase configurado).");
  },

  async deletePushSubscription() {
    throw new Error("Las notificaciones push no están disponibles en modo demo (requieren Supabase configurado).");
  },

  demoCredentials: DEMO_ADMIN,
};
