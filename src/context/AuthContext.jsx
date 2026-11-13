import { createContext, useContext, useEffect, useRef, useState } from "react";
import { db } from "../lib/dataStore";
import { clearDataCache } from "../lib/dataCache";
import { resolveAccess, resolveSession } from "../lib/authStartup";
import { forgetAccess } from "../lib/offlineAccess";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { SECTION_KEYS, ADMIN_ROLE_SLUG } from "../lib/accessControl";

const AuthContext = createContext(null);

// En modo demo no hay tabla real de accesos — se trata como administrador
// para poder explorar cualquier apartado en el sandbox local. La
// restricción real (modo Supabase) vive en admin_access/admin_roles.
const DEMO_ROLE = { slug: ADMIN_ROLE_SLUG, name: "Administrador", sections: SECTION_KEYS };

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [advisorId, setAdvisorId] = useState(null);
  const [loading, setLoading] = useState(true);

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
      // Salvo que el correo tenga un asesor vinculado en los accesos guardados del demo (Roles → Accesos): así se puede
      // probar el panel como asesor (Mi mes, Mis ventas…). No filtra datos: el demo no tiene RLS.
      setRole(DEMO_ROLE);
      const linked = await db.getMyAccess(email).catch(() => null);
      setAdvisorId(linked?.advisor_id || null);
      return;
    }
    const access = await resolveAccess(db, email);
    savedAccess.current = access.saved;
    setRole(access.role);
    setAdvisorId(access.advisorId);
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
          return;
        }
        offlineSession.current = false;
        setSession(current);
        await loadRole(current);
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
    return newSession;
  };

  const logout = async () => {
    forgetAccess();
    offlineSession.current = false;
    await db.signOut();
    setSession(null);
    setRole(null);
    setAdvisorId(null);
  };

  const sections = role?.sections || [];

  const value = {
    session,
    isAuthenticated: Boolean(session),
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
