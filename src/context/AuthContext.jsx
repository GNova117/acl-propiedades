import { useEffect, useRef, useState } from "react";
import { AuthContext } from "./useAuth.js";
import { db } from "../lib/dataStore";
import { clearDataCache } from "../lib/dataCache";
import { resolveAccess, resolveSession } from "../lib/authStartup";
import { forgetAccess } from "../lib/offlineAccess";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { SECTION_KEYS, ADMIN_ROLE_SLUG } from "../lib/accessControl";


// En modo demo no hay tabla real de accesos — se trata como administrador
// para poder explorar cualquier apartado en el sandbox local. La
// restricción real (modo Supabase) vive en admin_access/admin_roles.
const DEMO_ROLE = { slug: ADMIN_ROLE_SLUG, name: "Administrador", sections: SECTION_KEYS };

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [advisorId, setAdvisorId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Verificación en dos pasos: hay sesión con contraseña pero falta confirmar el código ({ factorId }); null = nada pendiente.
  const [mfaPending, setMfaPending] = useState(null);

  // El caché de listas (ver dataCache.js) es de una cuenta: al cerrar sesión o entrar con otra se vacía.
  const cacheOwner = useRef(undefined);
  // Sin señal el panel abre con lo último que se sabía de esta cuenta (lib/offlineAccess.js): `offlineSession` = la
  // sesión es solo el correo recordado (la real caducó y no se pudo renovar); `savedAccess` = el rol es el recordado.
  // Al volver la señal se vuelve a preguntar (ver el listener de «online» más abajo).
  const offlineSession = useRef(false);
  const savedAccess = useRef(false);

  const loadRole = async (newSession) => {
    const email = newSession?.user?.email;
    if (cacheOwner.current !== email) {
      clearDataCache();
      cacheOwner.current = email;
    }
    if (!email) {
      setRole(null);
      setAdvisorId(null);
      return;
    }
    if (!isSupabaseConfigured) {
      // Modo demo: siempre "ve todas las agendas" (sin asesor vinculado),
      // igual que el resto de secciones se tratan como administrador aquí.
      setRole(DEMO_ROLE);
      setAdvisorId(null);
      return;
    }
    const access = await resolveAccess(db, email);
    savedAccess.current = access.saved;
    setRole(access.role);
    setAdvisorId(access.advisorId);
  };

  // ¿La cuenta tiene la verificación activada y esta sesión aún no confirmó su código? Sin señal (sesión recordada) o si no
  // se puede preguntar, no se bloquea el panel: la base de datos igual protege lo sensible (ver mfa_ok en schema.sql).
  const checkMfa = async (newSession) => {
    if (!newSession?.user?.email || offlineSession.current) {
      setMfaPending(null);
      return null;
    }
    try {
      const status = await db.getMfaStatus();
      setMfaPending(status.needsCode ? { factorId: status.factorId } : null);
      return status;
    } catch {
      setMfaPending(null);
      return null;
    }
  };

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      // Sin red al abrir y con la sesión ya caducada no se puede renovar: se abre con la última cuenta de este
      // dispositivo (para ver el panel y capturar sin señal) y la sesión real se renueva sola al volver la señal.
      const { session: current, offline } = await resolveSession(db);
      offlineSession.current = offline;
      setSession(current);
      try {
        await loadRole(current);
      } catch {
        // Sin rol conocido (y sin poder preguntarlo): el panel muestra «sin acceso» en vez de quedarse cargando.
      }
      await checkMfa(current);
      setLoading(false);
    })();
    unsub = db.onAuthStateChange(async (newSession, event) => {
      // «INITIAL_SESSION» sin sesión: el estado inicial ya lo resolvió la lectura de arriba, y sin red (no pudo renovar la
      // caducada) tampoco es un cierre de sesión.
      if (!newSession && event === "INITIAL_SESSION") return;
      offlineSession.current = false;
      if (!newSession) forgetAccess();
      setSession(newSession);
      try {
        await loadRole(newSession);
      } catch {
        /* igual que arriba */
      }
      await checkMfa(newSession);
    });
    return () => unsub();
  }, []);

  // Al volver la señal con la sesión o el rol recordados, se pregunta de nuevo (sesión renovada y rol vigente). Si ya no
  // hay sesión válida, se cierra.
  useEffect(() => {
    const onOnline = async () => {
      if (!offlineSession.current && !savedAccess.current) return;
      try {
        const current = await db.getCurrentSession();
        if (!current) {
          offlineSession.current = false;
          forgetAccess();
          setSession(null);
          setRole(null);
          setAdvisorId(null);
          setMfaPending(null);
          return;
        }
        offlineSession.current = false;
        setSession(current);
        await loadRole(current);
        await checkMfa(current);
      } catch {
        /* sigue sin red de verdad: se reintenta la próxima vez que vuelva */
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const login = async (email, password) => {
    const newSession = await db.signIn(email, password);
    setSession(newSession);
    await loadRole(newSession);
    await checkMfa(newSession);
    return newSession;
  };

  // Confirma el código de la app de autenticación; al lograrlo el panel se abre solo (isAuthenticated pasa a verdadero).
  const verifyMfaCode = async (code) => {
    await db.verifyMfa(mfaPending.factorId, code);
    setMfaPending(null);
  };

  const logout = async () => {
    forgetAccess();
    offlineSession.current = false;
    await db.signOut();
    setSession(null);
    setRole(null);
    setAdvisorId(null);
    setMfaPending(null);
  };

  const sections = role?.sections || [];

  const value = {
    session,
    isAuthenticated: Boolean(session) && !mfaPending,
    mfaPending,
    verifyMfaCode,
    refreshMfa: () => checkMfa(session),
    role,
    sections,
    hasSection: (key) => sections.includes(key),
    isAdmin: role?.slug === ADMIN_ROLE_SLUG,
    advisorId,
    loading,
    login,
    logout,
    isDemoMode: !isSupabaseConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

