// Ayudantes de la firma de contratos desde el sitio (ver supabase/schema.sql,
// "Firma de contratos desde el sitio"): conversión de archivos, enlace público,
// estado efectivo de una solicitud y lectura de imágenes de huella.

export const SIGNING_MAX_PDF_BYTES = 8 * 1024 * 1024; // el límite en la base es ~10 MB de base64
export const SIGNING_CODE_MAX_ATTEMPTS = 5;

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function fileToBase64(file) {
  return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}

export const dataUrlToBase64 = (dataUrl) => String(dataUrl).split(",")[1] || "";

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const signingLink = (token) => `${window.location.origin}/firmar/${token}`;

// Estado que ve el personal: la base guarda pendiente/firmado/cancelado; caducada
// y bloqueada se deducen (vigencia y intentos fallidos).
export function effectiveStatus(request) {
  if (request.status !== "pendiente") return request.status;
  if (request.expires_at && new Date(request.expires_at) < new Date()) return "expirado";
  if ((request.failed_attempts || 0) >= SIGNING_CODE_MAX_ATTEMPTS) return "bloqueado";
  return "pendiente";
}

// Mensaje para mandar por WhatsApp: SOLO el enlace. El código se le da aparte
// (por llamada o en otro mensaje), para que un enlace filtrado no baste.
export function signingWhatsappText(request) {
  return `Hola ${request.signer_name}, te comparto el documento "${request.title}" de ACL Propiedades para que lo revises y lo firmes desde tu celular:\n${signingLink(request.token)}\n\nEl código para abrirlo te lo doy por separado.`;
}

// Convierte una imagen de huella (lo que exporta el software del lector, una
// captura o una foto) a PNG de hasta 500 px de ancho, para que pese poco.
export async function imageFileToFingerprintPng(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 500 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // las huellas suelen venir sobre fondo blanco o transparente
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return dataUrlToBase64(canvas.toDataURL("image/png"));
}
