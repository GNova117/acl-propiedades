import { isSupabaseConfigured } from "./supabaseClient";
import { localBackend } from "./localBackend";
import { supabaseBackend } from "./supabaseBackend";
import { TYPE_FACTORS } from "./seedData";

export const db = isSupabaseConfigured ? supabaseBackend : localBackend;
export { TYPE_FACTORS };
