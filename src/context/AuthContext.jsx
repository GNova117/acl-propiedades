import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../lib/dataStore";
import { isSupabaseConfigured } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const current = await db.getCurrentSession();
      setSession(current);
      setLoading(false);
    })();
    unsub = db.onAuthStateChange((newSession) => setSession(newSession));
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    const newSession = await db.signIn(email, password);
    setSession(newSession);
    return newSession;
  };

  const logout = async () => {
    await db.signOut();
    setSession(null);
  };

  const value = {
    session,
    isAuthenticated: Boolean(session),
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
