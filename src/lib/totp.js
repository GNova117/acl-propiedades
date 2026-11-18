// Códigos de un solo uso (TOTP, RFC 6238) de 6 dígitos cada 30 s, como los de Google Authenticator o Authy.
// En producción los verifica Supabase (Auth → MFA); esto lo usa SOLO el modo demo (localBackend) para que la pantalla de
// verificación en dos pasos se pueda probar de punta a punta sin servidor, y las pruebas automáticas.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function generateSecret(bytes = 20) {
  return base32Encode(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function hotp(secretBase32, counter, digits = 6) {
  const key = await crypto.subtle.importKey("raw", base32Decode(secretBase32), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const message = new Uint8Array(8);
  new DataView(message.buffer).setUint32(4, counter >>> 0);
  new DataView(message.buffer).setUint32(0, Math.floor(counter / 2 ** 32));
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export const STEP_SECONDS = 30;

export function totpCode(secretBase32, now = Date.now(), digits = 6) {
  return hotp(secretBase32, Math.floor(now / 1000 / STEP_SECONDS), digits);
}

// Acepta el código de este paso y el anterior/siguiente (relojes un poco desfasados).
export async function verifyTotp(secretBase32, code, now = Date.now(), window = 1) {
  const typed = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(typed)) return false;
  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  for (let drift = -window; drift <= window; drift += 1) {
    if ((await hotp(secretBase32, counter + drift)) === typed) return true;
  }
  return false;
}

// Dirección que leen las apps de autenticación (se muestra como QR).
export function otpauthUri(secretBase32, account, issuer = "ACL Propiedades") {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
