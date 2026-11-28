// 460: mensaje para avisar al dueño de la propiedad cada vez que cambia su estatus (publicada, apartada, vendida, rentada). Texto
// de partida editable: el asesor lo ajusta, lo copia o lo abre en WhatsApp sin número (elige a quién mandarlo). El dueño todavía no
// se guarda ligado a la propiedad (eso necesita base de datos: ver la lista de pendientes), por eso no hay envío automático.
export const OWNER_STATUSES = ["disponible", "apartada", "vendida", "rentada"];

// `t`: función de traducción. `url`: dirección pública de la propiedad (solo se usa en «disponible»).
export function buildOwnerMessage(t, property, status, url) {
  const key = OWNER_STATUSES.includes(status) ? status : "disponible";
  return t(`ownerMessage.templates.${key}`, { title: property?.title || "", code: property?.code || "", url: url || "" }).trim();
}

// WhatsApp sin número: se abre para elegir el contacto y ya trae el texto.
export function whatsappDraftUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
