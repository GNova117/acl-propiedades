// Autorización de las funciones que dispara la base (pg_cron y triggers vía pg_net) con el encabezado `x-cron-secret`.
//
// Antes todas compartían UN secreto: si se filtraba el de una llamada (un registro, una captura), servía para disparar cualquiera de
// las doce funciones. Ahora cada función tiene el suyo, DERIVADO del secreto maestro:
//     secreto de la función = HMAC-SHA256(llave = CRON_SECRET, mensaje = nombre de la función), en hexadecimal.
// La base lo calcula igual con cron_secret_for('<función>') (migración 0122) y el secreto maestro nunca viaja en una llamada; el que
// se filtre solo abre esa función y no se puede convertir en el de otra. No hay secretos nuevos que sembrar: sigue siendo el mismo
// CRON_SECRET (Vault `agenda_cron_secret` ↔ variable de la función).
//
// Transición: mientras CRON_ACCEPT_SHARED_SECRET no valga "false", se acepta también el secreto maestro tal cual (llamadas viejas,
// pruebas a mano con curl). Una vez aplicada la migración 0122 y comprobado que todo funciona, se apaga con
// `supabase secrets set CRON_ACCEPT_SHARED_SECRET=false` y desde entonces solo valen los secretos por función.

const encoder = new TextEncoder();

export async function deriveCronSecret(master, functionName) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(master), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(functionName));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante (sobre las dos cadenas completas, del mismo largo o no).
export function safeEqual(a, b) {
  const x = encoder.encode(String(a));
  const y = encoder.encode(String(b));
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// `provided`: lo que mandó la llamada en x-cron-secret. Devuelve true si es el secreto de ESTA función (o, en transición, el maestro).
export async function checkCronSecret(provided, functionName, { master, acceptShared = true } = {}) {
  if (!master || !provided) return false;
  if (safeEqual(provided, await deriveCronSecret(master, functionName))) return true;
  return acceptShared && safeEqual(provided, master);
}

// Atajo para las funciones de Edge (Deno): lee CRON_SECRET y CRON_ACCEPT_SHARED_SECRET del entorno.
export function isCronAuthorized(req, functionName) {
  const env = globalThis.Deno?.env;
  return checkCronSecret(req.headers.get("x-cron-secret"), functionName, {
    master: env?.get("CRON_SECRET"),
    acceptShared: env?.get("CRON_ACCEPT_SHARED_SECRET") !== "false",
  });
}
