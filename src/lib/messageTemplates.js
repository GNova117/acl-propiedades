import { formatMXN } from "./format";

// Plantillas de respuesta rápida para Mensajes de contacto: las 4
// situaciones más frecuentes (disponibilidad, precio, agendar visita,
// agradecimiento) que de otro modo se escriben a mano cada vez. "price"
// solo aplica si el mensaje viene ligado a una propiedad — sin ella no hay
// precio que compartir.
export function quickReplyTemplates(t, message, property) {
  const name = (message.name || "").trim().split(/\s+/)[0] || "";
  const propertyLabel = property?.title || t("messages.templates.theProperty");

  const templates = [
    { key: "availability", label: t("messages.templates.availabilityLabel"), text: t("messages.templates.availabilityText", { name, property: propertyLabel }) },
  ];
  if (property) {
    templates.push({
      key: "price",
      label: t("messages.templates.priceLabel"),
      text: t("messages.templates.priceText", { name, property: propertyLabel, price: formatMXN(property.price) }),
    });
  }
  templates.push(
    { key: "visit", label: t("messages.templates.visitLabel"), text: t("messages.templates.visitText", { name, property: propertyLabel }) },
    { key: "thanks", label: t("messages.templates.thanksLabel"), text: t("messages.templates.thanksText", { name }) }
  );
  return templates;
}
