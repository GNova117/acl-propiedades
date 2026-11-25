// Depuración mensual de la papelería de clientes que cumplió 3 años sin actividad (ver la migración 0123 y handler.js).
// La dispara pg_cron el día 1 de cada mes con el secreto propio de esta función (x-cron-secret, ver _shared/cronAuth.js), así que se
// despliega con la verificación de JWT desactivada. Usa la service role que inyecta Supabase.
// POR OMISIÓN ES UN SIMULACRO (solo cuenta y registra en retention_purge_log). Para que borre de verdad:
//   supabase secrets set RETENTION_PURGE_ENABLED=true
// Invocarla a mano con {"dryRun": true} fuerza el simulacro aunque esté activada.

import { isCronAuthorized } from "../_shared/cronAuth.js";
import { runPapeleriaPurge } from "./handler.js";

async function handler(req: Request): Promise<Response> {
  if (!(await isCronAuthorized(req, "depurar-papeleria"))) {
    return new Response("unauthorized", { status: 401 });
  }
  const payload = await req.json().catch(() => ({}));
  // deno-lint-ignore no-explicit-any
  const enabled = (globalThis as any).Deno.env.get("RETENTION_PURGE_ENABLED") === "true" && payload?.dryRun !== true;

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno.env;
  const supabase = createClient(env.get("SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: due, error } = await supabase.rpc("papeleria_vencida");
    if (error) throw new Error(error.message);

    const summary = await runPapeleriaPurge({
      due: due || [],
      enabled,
      removeFiles: async (bucket: string, paths: string[]) => {
        const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
        // Si falla el lote, ningún archivo se da por borrado: sus filas se quedan para el siguiente intento.
        return { failed: removeError ? paths : [] };
      },
      deleteRows: async (table: string, ids: string[]) => {
        const { error: deleteError } = await supabase.from(table).delete().in("id", ids);
        if (deleteError) throw new Error(deleteError.message);
      },
    });

    await supabase.from("retention_purge_log").insert({
      dry_run: summary.dryRun,
      documents_due: summary.due,
      documents_deleted: summary.deleted,
      files_failed: summary.filesFailed,
      detail: summary.byKind,
    });
    return new Response(JSON.stringify(summary), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("depurar-papeleria", err);
    return new Response(JSON.stringify({ error: "No se pudo depurar la papelería" }), { status: 500 });
  }
}

// Solo dentro de Deno (en las pruebas se importa handler.js y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}
