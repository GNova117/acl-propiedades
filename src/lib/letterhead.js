// Hoja membretada (logotipo, marca de agua y pie) sobre la que se arman los PDF de ACL Propiedades.
//
// El archivo ya NO es público: vive en server/assets/ y solo lo entrega /api/plantilla a quien tenga sesión y el
// apartado "Plantilla membretada" (clave `membrete`) en su rol — ver api/plantilla.js y /admin/roles. Con una hoja
// membretada a la mano cualquiera podría falsificar documentos con el logotipo y el pie de la empresa.
//
// Quien no tiene acceso (un cliente que baja su guía o su documento firmado, un asesor sin ese apartado) recibe el
// mismo PDF sobre una hoja carta en blanco: el contenido se dibuja igual, solo sin el membrete. El modo demostración
// (sin Supabase) tampoco tiene la hoja y usa la hoja en blanco.
import { isSupabaseConfigured, supabase } from "./supabaseClient";

export const LETTER_SIZE = [612, 792];

/** @returns {Promise<ArrayBuffer>} */
export async function blankLetterhead() {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.addPage(LETTER_SIZE);
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// Una sola descarga por sesión (la hoja pesa ~3.7 MB): se recuerda el resultado, también cuando no hubo acceso, para
// no pedirla en cada PDF. Se vuelve a pedir si cambia la sesión (otro usuario, otro rol).
let cache = { token: undefined, promise: null };

/** @returns {Promise<ArrayBuffer>} */
async function fetchLetterhead(token) {
  if (!token) return blankLetterhead();
  try {
    const res = await fetch("/api/plantilla", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return await res.arrayBuffer();
  } catch {
    /* sin red o sin la función: se usa la hoja en blanco */
  }
  return blankLetterhead();
}

/** @returns {Promise<ArrayBuffer>} */
export async function loadLetterhead() {
  let token = null;
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token ?? null;
  }
  if (cache.promise === null || cache.token !== token) cache = { token, promise: fetchLetterhead(token) };
  return /** @type {Promise<ArrayBuffer>} */ (cache.promise);
}

// Para las pruebas y al cerrar sesión.
export function resetLetterheadCache() {
  cache = { token: undefined, promise: null };
}
