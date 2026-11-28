// ¿El inicio de sesión falló por la red o el servidor (no por la contraseña)? Con Supabase: sin conexión, TypeError de fetch,
// AuthRetryableFetchError (status 0) o un 5xx. Una contraseña incorrecta es un 400 «invalid_credentials».
export function isLoginNetworkError(err, online = typeof navigator === "undefined" ? true : navigator.onLine) {
  if (online === false) return true;
  if (!err) return false;
  if (err instanceof TypeError) return true;
  if (err.name === "AuthRetryableFetchError") return true;
  const status = Number(err.status);
  return status === 0 || status >= 500;
}
