import { useTranslation } from "react-i18next";

const CLASS_BY_STATE = {
  aprobado: "portal-badge portal-badge--ok",
  recibido: "portal-badge portal-badge--ok",
  en_revision: "portal-badge portal-badge--neutral",
  corregir: "portal-badge portal-badge--error",
  pendiente: "portal-badge portal-badge--warning",
};

// Estado de un documento en la lista de pendientes del cliente (ver
// portalChecklist en lib/clientPortal.js), con palabras del cliente: no
// "requiere revisión" (eso es para el asesor) sino "Falta", "En revisión"...
export default function PortalChecklistBadge({ state }) {
  const { t } = useTranslation();
  return <span className={CLASS_BY_STATE[state] || CLASS_BY_STATE.pendiente}>{t(`portal.checklist.states.${state || "pendiente"}`)}</span>;
}
