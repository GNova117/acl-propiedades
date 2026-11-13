// Acciones en lote sobre varios prospectos a la vez (Prospectos → «Seleccionar»): cambiar de etapa, poner
// el siguiente seguimiento y —la oficina— reasignar de asesor. Funciones puras salvo applyBulk, que recibe
// el `db` para poder probarse sin red.

import { addDaysISO, isOpenStage } from "./prospects";

export const BULK_KINDS = ["stage", "followup", "advisor"];

// Los campos que cambia la acción `kind` con el valor `value` en este prospecto; null si no hay nada que
// cambiar (ya estaba así o no aplica):
//   stage    — la etapa (al salir de «perdido» se limpia el motivo, como al cambiarla en la tarjeta);
//   followup — la fecha del siguiente seguimiento (YYYY-MM-DD) o null para quitarla; solo en etapas
//              abiertas: un prospecto cerrado o perdido no tiene seguimiento;
//   advisor  — el asesor responsable (id).
export function bulkFields(kind, value, prospect) {
  if (kind === "stage") {
    if (!value || prospect.stage === value) return null;
    return { stage: value, ...(value === "perdido" ? {} : { lost_reason: null }) };
  }
  if (kind === "followup") {
    if (!isOpenStage(prospect.stage)) return null;
    const next = value || null;
    return (prospect.next_followup_at || null) === next ? null : { next_followup_at: next };
  }
  if (kind === "advisor") {
    if (!value || prospect.advisor_id === value) return null;
    return { advisor_id: value };
  }
  return null;
}

// Fecha de seguimiento para los atajos «mañana», «en 3 días»…; "" (sin fecha) para quitarla.
export const followupDate = (days, from = new Date()) => (days == null ? "" : addDaysISO(days, from));

/**
 * Aplica la acción a cada prospecto, UNO POR UNO (no en paralelo: en modo demo, localStorage se lee y se
 * escribe completo en cada cambio y dos a la vez se pisarían). Devuelve { updated: [registros ya
 * actualizados], skipped: cuántos no tenían nada que cambiar, failed: cuántos fallaron }.
 */
export async function applyBulk(db, prospects, kind, value) {
  const result = { updated: [], skipped: 0, failed: 0 };
  for (const prospect of prospects) {
    const fields = bulkFields(kind, value, prospect);
    if (!fields) {
      result.skipped += 1;
      continue;
    }
    try {
      result.updated.push(await db.updateProspect(prospect.id, fields));
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
