// Reglas del plano que se sube a mano al formulario de la propiedad (los que salen
// de Construcción pesan mucho menos).
export const FLOOR_PLAN_MAX_BYTES = 8 * 1024 * 1024;
export const FLOOR_PLAN_TYPES = ["image/png", "image/jpeg"];

// null si el archivo sirve; si no, la llave de i18n del motivo.
export function floorPlanFileError(file) {
  if (!file || !FLOOR_PLAN_TYPES.includes(file.type)) return "floorPlan.invalidType";
  if (file.size > FLOOR_PLAN_MAX_BYTES) return "floorPlan.tooBig";
  return null;
}
