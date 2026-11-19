// Reglas de la contraseña nueva al restablecerla (el enlace del correo abre /admin/restablecer). Devuelve la clave
// i18n del primer problema o null si está bien. Supabase acepta desde 6 caracteres; aquí se pide un poco más.
export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password, confirm) {
  const value = String(password ?? "");
  if (value.length < MIN_PASSWORD_LENGTH) return "passwordReset.errors.short";
  if (value.trim() !== value) return "passwordReset.errors.spaces";
  if (value !== String(confirm ?? "")) return "passwordReset.errors.mismatch";
  return null;
}
