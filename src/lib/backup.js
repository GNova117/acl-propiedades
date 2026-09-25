// Respaldo de los datos del panel en un solo archivo JSON.
//
// - Con Supabase: lee cada tabla con la sesión de quien lo pide, así que solo
//   entra lo que ese usuario puede ver por RLS (p. ej. las liquidaciones solo
//   las ven los socios). Lo que no pudo leer queda anotado en `errors`.
// - En modo demo: vuelca lo guardado en el navegador (claves acl_local_*).
// - NO incluye los archivos del Storage (fotos, INE, PDFs): solo las tablas;
//   las rutas de esos archivos sí vienen en las filas.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

const TABLES = [
  "zones", "advisors", "properties", "property_advisors", "property_types", "amenities_catalog",
  "contact_messages", "testimonials", "clients", "client_documents", "client_links",
  "perfilamientos", "perfilamientos_comprador", "remodel_projects", "remodel_progress_entries",
  "materials_catalog", "labor_catalog", "liquidaciones", "ventas", "property_log", "property_budgets",
  "property_changes", "property_visits", "property_report_links", "agenda_citas", "agenda_expedientes",
  "agenda_resumenes_enviados", "construccion_proyectos", "construccion_habitaciones", "construccion_muros",
  "construccion_aberturas", "construccion_catalogo_materiales", "construccion_objetos", "secretaria_llaves",
  "secretaria_documentos", "valuation_estimates", "admin_roles", "admin_access",
];

const PAGE = 1000;
export const LAST_BACKUP_KEY = "acl_last_backup";
export const BACKUP_STALE_DAYS = 7;

async function readTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function collectBackup() {
  const tables = {};
  const errors = {};

  if (isSupabaseConfigured) {
    for (const table of TABLES) {
      try {
        tables[table] = await readTable(table);
      } catch (err) {
        errors[table] = err.message || String(err);
      }
    }
  } else {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key.startsWith("acl_local_") || key === "acl_local_session") continue;
      try {
        tables[key.replace("acl_local_", "")] = JSON.parse(window.localStorage.getItem(key));
      } catch {
        errors[key] = "No se pudo leer";
      }
    }
  }

  const counts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 1]));
  return {
    meta: {
      app: "ACL Propiedades",
      created_at: new Date().toISOString(),
      source: isSupabaseConfigured ? "supabase" : "demo-local",
      counts,
      errors,
      note: "Incluye datos de las tablas; no incluye los archivos del Storage (fotos y documentos).",
    },
    tables,
  };
}

export const lastBackupAt = () => {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
};

export const isBackupStale = () => {
  const last = lastBackupAt();
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > BACKUP_STALE_DAYS * 24 * 3600 * 1000;
};

// Genera el respaldo y dispara la descarga. Devuelve el resumen (meta).
export async function downloadBackup() {
  const backup = await collectBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `Respaldo_ACL_${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, backup.meta.created_at);
  } catch {
    /* sin almacenamiento: el respaldo ya se descargó */
  }
  return { ...backup.meta, bytes: blob.size };
}
