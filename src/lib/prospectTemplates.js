import { formatMXN } from "./format";
import { postsaleMessage } from "./postsale";

// Plantillas de WhatsApp / correo para Prospectos. Mismo patrón que
// messageTemplates.js (Mensajes de contacto): funciones puras con `t` por
// parámetro. Aquí el orden depende de la etapa del prospecto, para que lo más
// probable que el asesor quiera mandar salga primero en el selector.
//
// Etapa → claves en el orden en que se ofrecen. "cerrado" reutiliza los textos
// de posventa (postsale.js) para poder mandarlos aunque aún no toque el aviso.
const ORDER_BY_STAGE = {
  nuevo: ["first", "visit", "price", "followup", "postVisit", "offer", "reactivate"],
  contactado: ["followup", "visit", "price", "postVisit", "offer", "reactivate", "first"],
  interesado: ["visit", "price", "followup", "postVisit", "offer", "reactivate", "first"],
  negociacion: ["offer", "price", "postVisit", "followup", "visit", "reactivate", "first"],
  cerrado: ["postsale30", "postsale180"],
  perdido: ["reactivate", "followup", "first"],
};

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// `property`: la propiedad de interés (si tiene); `advisorName`: quien firma el
// mensaje (el asesor responsable). Sin propiedad no hay "price".
export function prospectTemplates(t, prospect, { property = null, advisorName = "" } = {}) {
  const vars = {
    name: firstName(prospect.name),
    advisor: advisorName ? t("prospects.templates.signedBy", { advisor: advisorName }) : t("prospects.templates.theAgency"),
    property: property?.title || t("prospects.templates.theSearch"),
    price: property?.price != null ? formatMXN(property.price) : "",
  };

  const text = (key) => {
    if (key === "postsale30" || key === "postsale180") return postsaleMessage(prospect, key.slice(8), property?.title || "");
    return t(`prospects.templates.${key}Text`, vars);
  };

  let keys = ORDER_BY_STAGE[prospect.stage] || ORDER_BY_STAGE.nuevo;
  if (!property) keys = keys.filter((key) => key !== "price");
  // Vino de una visita: lo natural es preguntar qué le pareció.
  if (prospect.visit_id && ["nuevo", "contactado", "interesado"].includes(prospect.stage)) {
    keys = ["postVisit", ...keys.filter((key) => key !== "postVisit")];
  }

  return keys.map((key) => ({ key, label: t(`prospects.templates.${key}Label`), text: text(key) }));
}
