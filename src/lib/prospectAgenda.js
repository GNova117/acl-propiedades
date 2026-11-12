// "Agendar" desde un prospecto: los datos con los que se abre "Nueva cita" ya
// llenos, para que el asesor solo ponga fecha y hora. Función pura.

// `t`: la función de traducción (como en criteriaSummary). La cita queda ligada
// al prospecto (`prospecto_id`) y a su propiedad de interés (`property_id`): así
// "Registrar visita" la prellena y, al registrarla, el prospecto avanza solo.
// Si el prospecto ya es cliente se liga el cliente; si no, sus datos de
// contacto viajan en la propia cita (para mandarle el enlace por WhatsApp).
export function prospectToCitaPrefill(prospect, { propertyTitle = "", t }) {
  const name = String(prospect.name || "").trim();
  const lookingFor = String(prospect.looking_for || "").trim();
  return {
    advisor_id: prospect.advisor_id || "",
    titulo: propertyTitle ? t("prospects.schedulePrefill.visit", { property: propertyTitle }) : t("prospects.schedulePrefill.meeting", { name }),
    property_id: prospect.property_id || "",
    prospecto_id: prospect.id,
    ...(prospect.client_id
      ? { client_id: prospect.client_id }
      : { contact_name: name, contact_phone: String(prospect.phone || "").trim(), contact_email: String(prospect.email || "").trim() }),
    actividades: lookingFor ? t("prospects.schedulePrefill.lookingFor", { text: lookingFor }) : "",
  };
}
