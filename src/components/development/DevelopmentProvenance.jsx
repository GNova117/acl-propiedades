import { useTranslation } from "react-i18next";
import Logo from "../Logo";
import "./development.css";

// Deja claro de quién es el proyecto y quién lo vende: el desarrollador a la
// izquierda, ACL a la derecha como comercializadora. Va en la página de la
// torre y repetida (compacta) en la ficha de cada departamento, para que
// nadie confunda a ACL con la empresa constructora.
export default function DevelopmentProvenance({ development, compact = false }) {
  const { t } = useTranslation();
  return (
    <div className={`dev-provenance ${compact ? "dev-provenance--compact" : ""}`} role="group" aria-label={t("developments.provenance.aria")}>
      <div className="dev-provenance__party">
        <span className="dev-provenance__role">{t("developments.provenance.developedBy")}</span>
        {development.developer_logo ? (
          <img src={development.developer_logo} alt={development.developer_name} className="dev-provenance__logo" />
        ) : (
          <strong className="dev-provenance__name">{development.developer_name}</strong>
        )}
      </div>
      <span className="dev-provenance__divider" aria-hidden="true" />
      <div className="dev-provenance__party dev-provenance__party--acl">
        <span className="dev-provenance__role">{t("developments.provenance.soldBy")}</span>
        <Logo variant="white" size="sm" />
      </div>
    </div>
  );
}
