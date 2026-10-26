import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Reveal from "./Reveal";
import "./GuideBanner.css";

// Franja que lleva a la Guía del comprador (/guia-del-comprador). Vive en el
// blog (listado y al final de cada artículo), no en el inicio, para no
// recargar la parte de arriba de la página principal. No trae su propia
// sección ni contenedor: se coloca dentro del de la página que la usa.
export default function GuideBanner({ className = "" }) {
  const { t } = useTranslation();
  return (
    <Reveal>
      <div className={`guide-banner ${className}`.trim()}>
        <div>
          <span className="section-heading__eyebrow">{t("buyerGuide.bannerEyebrow")}</span>
          <h2>{t("buyerGuide.bannerTitle")}</h2>
          <p>{t("buyerGuide.bannerText")}</p>
        </div>
        <Link to="/guia-del-comprador" className="btn btn-primary">{t("buyerGuide.bannerCta")}</Link>
      </div>
    </Reveal>
  );
}
