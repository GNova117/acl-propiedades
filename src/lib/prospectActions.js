// Piezas compartidas por las pantallas que trabajan un prospecto: la tarjeta de
// Prospectos, "Mi día" y la ficha del prospecto. Funciones puras (salvo
// convertProspectToClient, que recibe el `db` para poder probarse sin red).

import { daysSince } from "./prospects";
import { whatsappDigits } from "./format";
import { prospectMessageTemplates } from "./prospectMessages";

// tel: para llamar desde el teléfono (10 dígitos → lada de México). null sin número.
export const telHref = (phone) => {
  const digits = whatsappDigits(phone);
  return digits ? `tel:${digits.length === 10 ? `+52${digits}` : `+${digits}`}` : null;
};

// Chat de WhatsApp en blanco con el prospecto. null sin número.
export function whatsappLink(phone) {
  let digits = whatsappDigits(phone);
  if (digits.length === 10) digits = `52${digits}`;
  return digits ? `https://wa.me/${digits}` : null;
}

// Mensajes rápidos del prospecto (los de su etapa primero), con el nombre ya
// puesto y la etiqueta traducida para el selector.
export const quickTemplates = (prospect, { propertyTitle = "", advisorName = "", origin = "", t }) =>
  prospectMessageTemplates(prospect, {
    propertyTitle,
    propertyUrl: prospect.property_id ? `${origin}/propiedades/${prospect.property_id}` : "",
    advisorName,
  }).map((tpl) => ({ ...tpl, label: t(`prospects.templates.${tpl.key}`) }));

// "Último contacto: hace 3 días" (o "Sin contacto aún").
export function contactAgoText(prospect, t) {
  const days = daysSince(prospect.last_contact_at);
  if (days == null) return t("prospects.noContact");
  if (days <= 0) return t("prospects.contactToday");
  return t("prospects.contactAgo", { count: days });
}

// El cliente que ya existe con el mismo teléfono (últimos 10 dígitos) o correo.
export function findExistingClient(clients, prospect) {
  const digits = whatsappDigits(prospect.phone);
  const email = String(prospect.email || "").trim().toLowerCase();
  return (
    clients.find(
      (c) => (digits.length >= 10 && whatsappDigits(c.phone).endsWith(digits.slice(-10))) || (email && String(c.email || "").toLowerCase() === email)
    ) || null
  );
}

// Datos del cliente nuevo que sale de un prospecto (comprador por omisión; el
// tipo se cambia en su ficha).
export function clientFromProspect(prospect) {
  return {
    name: prospect.name,
    type: "comprador",
    email: prospect.email || null,
    phone: prospect.phone || null,
    notes: [prospect.looking_for && `Busca: ${prospect.looking_for}`, prospect.notes].filter(Boolean).join("\n") || null,
    active: true,
  };
}

// Convierte al prospecto en cliente y deja ligados a los dos. Si ya hay un
// cliente con ese teléfono o correo, `confirmExisting(cliente)` decide si se
// vincula ese en vez de duplicarlo. Devuelve el id del cliente, o null si se
// canceló.
export async function convertProspectToClient(db, prospect, confirmExisting) {
  const existing = findExistingClient(await db.getClients(), prospect);
  let clientId;
  if (existing) {
    if (!(await confirmExisting(existing))) return null;
    clientId = existing.id;
  } else {
    clientId = (await db.addClient(clientFromProspect(prospect))).id;
  }
  await db.updateProspect(prospect.id, { client_id: clientId });
  return clientId;
}
