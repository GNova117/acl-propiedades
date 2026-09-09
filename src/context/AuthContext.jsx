import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../lib/dataStore";
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

  const loadRole = async (newSession) => {
    const email = newSession?.user?.email;
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
    const access = await db.getMyAccess(email);
    setRole(access?.role || null);
    setAdvisorId(access?.advisor_id || null);
  };

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const current = await db.getCurrentSession();
      setSession(current);
      await loadRole(current);
      setLoading(false);
    })();
    unsub = db.onAuthStateChange(async (newSession) => {
      setSession(newSession);
      await loadRole(newSession);
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    const newSession = await db.signIn(email, password);
    setSession(newSession);
    await loadRole(newSession);
    return newSession;
  };

  const logout = async () => {
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
