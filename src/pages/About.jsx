import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useBusinessJsonLd from "../lib/useBusinessJsonLd";
import Seo from "../components/Seo";
import AdvisorCard from "../components/AdvisorCard";
import { db } from "../lib/dataStore";
import "./About.css";
import { OFFICE } from "../lib/office";

// Link corto de la ficha real de "ACL Propiedades" en Google Maps (Share
// desde la app) — a propósito en vez de un link armado con las
// coordenadas, que abriría un pin genérico sin nombre ni reseñas del
// negocio.
const GOOGLE_MAPS_BUSINESS_URL = "https://maps.app.goo.gl/3zYmxmYrREfk5fC78";

export default function About() {
  const { t } = useTranslation();
  const businessJsonLd = useBusinessJsonLd();
  const [advisors, setAdvisors] = useState([]);

  useEffect(() => {
    db.getAdvisors().then((data) => setAdvisors(data.filter((a) => a.active !== false && a.show_in_team !== false)));
  }, []);

  return (
    <>
      <Seo title={t("nav.about")} description={t("about.intro")} jsonLd={businessJsonLd} />

      <div className="container about-page">
        <div className="section-heading m-section">
          <h2>{t("about.title")}</h2>
          <p>{t("about.intro")}</p>
        </div>

        <div className="about-page__grid">
          <div className="card about-page__block">
            <h3>{t("about.missionTitle")}</h3>
            <p>{t("about.mission")}</p>
          </div>
          <div className="card about-page__block">
            <h3>{t("about.visionTitle")}</h3>
            <p>{t("about.vision")}</p>
          </div>
          <div className="card about-page__block">
            <h3>{t("about.valuesTitle")}</h3>
            <p>{t("about.values")}</p>
          </div>
        </div>

        <div className="about-page__grid about-page__grid--two">
          <div className="card about-page__block">
            <h3>{t("about.hoursTitle")}</h3>
            <p>{t("about.hours1")}</p>
            <p>{t("about.hours2")}</p>
          </div>
          <div className="card about-page__block">
            <h3>{t("about.addressTitle")}</h3>
            <p>{OFFICE.addressShort}</p>
            <p>Torreón, Coahuila</p>
            <a href={GOOGLE_MAPS_BUSINESS_URL} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
              {t("about.viewOnMaps")}
            </a>
          </div>
        </div>

        <div className="card about-page__block" style={{ marginBottom: "3rem" }}>
          <h3>{t("about.paymentMethodsTitle")}</h3>
          <p>{t("about.paymentMethodsBody")}</p>
        </div>

        <h3 className="about-page__team-title">{t("about.team")}</h3>
        <div className="about-page__team">
          {advisors.map((advisor) => (
            <AdvisorCard key={advisor.id} advisor={advisor} />
          ))}
        </div>
      </div>
    </>
  );
}
