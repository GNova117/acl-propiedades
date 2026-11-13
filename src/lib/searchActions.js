// Atajos de contacto de un resultado de la búsqueda global (Llamar y WhatsApp), para no tener que abrir
// la ficha solo para marcar. Función pura.

import { whatsappDigits } from "./format";
import { telHref, whatsappLink } from "./prospectActions";

// El primer teléfono utilizable de un resultado (10 dígitos o más) con sus enlaces; null si no hay.
export function phoneActions(phones = []) {
  const phone = phones.find((p) => whatsappDigits(p).length >= 10);
  return phone ? { phone, call: telHref(phone), whatsapp: whatsappLink(phone) } : null;
}
