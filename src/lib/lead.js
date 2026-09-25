// Envío de prospectos desde formularios públicos (simulador de crédito,
// "vende tu casa"). Cada envío es un contact_message más — mismo inbox en
// /admin/mensajes y mismo aviso automático de WhatsApp — con un `channel` que
// dice de dónde vino y un `details` con los datos capturados.
//
// Anti-spam simple, igual que ContactForm: un campo trampa que un humano nunca
// llena y un envío por minuto por navegador y formulario. No detiene a un
// atacante dedicado, pero sí a los bots genéricos.

import { db } from "./dataStore";

const RATE_LIMIT_MS = 60_000;
export const MIN_PHONE_DIGITS = 10;

export const isValidPhone = (value) => String(value || "").replace(/\D/g, "").length >= MIN_PHONE_DIGITS;

// Devuelve "success" | "rateLimited" | "error".
export async function sendLead({ rateKey, honeypot, name, phone, message, channel, details }) {
  // Campo trampa lleno: éxito falso, sin escribir nada.
  if (String(honeypot || "").trim()) return "success";

  try {
    const last = Number(window.localStorage.getItem(rateKey) || 0);
    if (Date.now() - last < RATE_LIMIT_MS) return "rateLimited";
  } catch {
    /* sin almacenamiento: se omite el límite */
  }

  try {
    await db.submitContactMessage({
      name: name.trim(),
      email: "",
      phone: phone.trim(),
      message,
      channel,
      details: details || null,
    });
    try {
      window.localStorage.setItem(rateKey, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
    return "success";
  } catch {
    return "error";
  }
}
