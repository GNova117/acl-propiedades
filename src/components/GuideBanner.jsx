import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Reveal from "./Reveal";
import "./GuideBanner.css";

// Franja del inicio que lleva a la Guía del comprador (/guia-del-comprador).
export default function GuideBanner() {
  const { t } = useTranslation();
  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <div className="guide-banner">
            <div>
              <span className="section-heading__eyebrow">{t("buyerGuide.bannerEyebrow")}</span>
              <h2>{t("buyerGuide.bannerTitle")}</h2>
              <p>{t("buyerGuide.bannerText")}</p>
            </div>
            <Link to="/guia-del-comprador" className="btn btn-primary">{t("buyerGuide.bannerCta")}</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
