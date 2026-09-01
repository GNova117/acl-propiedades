import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import AdvisorCard from "../components/AdvisorCard";
import { db } from "../lib/dataStore";
import "./About.css";

export default function About() {
  const { t } = useTranslation();
  const [advisors, setAdvisors] = useState([]);

  useEffect(() => {
    db.getAdvisors().then((data) => setAdvisors(data.filter((a) => a.active !== false)));
  }, []);

  return (
    <>
      <Seo title={t("nav.about")} description={t("about.intro")} />

      <div className="container about-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h2>{t("about.title")}</h2>
          <p>{t("about.intro")}</p>
        </div>

        <div className="about-page__grid">
          <div className="card about-page__block">
            <h3>{t("about.missionTitle")}</h3>
            <p>{t("about.mission")}</p>
          </div>
          <div className="card about-page__block">
            <h3>{t("about.hoursTitle")}</h3>
            <p>{t("about.hours1")}</p>
            <p>{t("about.hours2")}</p>
          </div>
          <div className="card about-page__block">
            <h3>{t("about.addressTitle")}</h3>
            <p>{t("about.address")}</p>
            <p>Torreón, Coahuila</p>
          </div>
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
