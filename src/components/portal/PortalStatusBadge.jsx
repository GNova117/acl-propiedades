import { useTranslation } from "react-i18next";

const CLASS_BY_STATUS = {
  valido: "portal-badge portal-badge--ok",
  requiere_revision: "portal-badge portal-badge--warning",
  rechazado: "portal-badge portal-badge--error",
  pendiente: "portal-badge portal-badge--neutral",
};

export default function PortalStatusBadge({ status }) {
  const { t } = useTranslation();
  return <span className={CLASS_BY_STATUS[status] || CLASS_BY_STATUS.pendiente}>{t(`portal.status.${status || "pendiente"}`)}</span>;
}
