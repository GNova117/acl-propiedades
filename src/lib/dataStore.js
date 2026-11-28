import { isSupabaseConfigured } from "./supabaseClient";
import { supabaseBackend } from "./supabaseBackend";

export { TYPE_FACTORS } from "./typeFactors";

// Con Supabase configurado (el sitio real) el backend de demostración (localStorage) y sus datos semilla con fotos NO se descargan: se
// importa solo cuando no hay base. Antes entraba siempre al paquete público (~200 kB).
export const db = isSupabaseConfigured ? supabaseBackend : (await import("./localBackend")).localBackend;
