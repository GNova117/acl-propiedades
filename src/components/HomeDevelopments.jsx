import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DevelopmentCard from "./DevelopmentCard";
import Reveal from "./Reveal";
import { db } from "../lib/dataStore";
import "./HomeDevelopments.css";

const MAX_HOME_DEVELOPMENTS = 3;

// 316: el inicio no mostraba los desarrollos (torres y proyectos) ni invitaba a las herramientas del comprador (comparador de
// créditos, guía, calculadora). Sin desarrollos publicados no se pinta la tira, pero las herramientas siempre salen.
export default function HomeDevelopments() {
  const { t } = useTranslation();
  const [developments, setDevelopments] = useState([]);

  useEffect(() => {
    let active = true;
    db.getDevelopments({ publishedOnly: true })
      .then((data) => active && setDevelopments(data.slice(0, MAX_HOME_DEVELOPMENTS)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const tools = [
    { to: "/comparar-creditos", key: "credits" },
    { to: "/guia-del-comprador", key: "guide" },
    { to: "/calculadora", key: "calculator" },
  ];

  return (
    <>
      {developments.length > 0 && (
        <section className="section">
          <div className="container">
            <Reveal className="section-heading">
              <span className="section-heading__eyebrow">{t("developments.eyebrow")}</span>
              <h2>{t("developments.stripTitle")}</h2>
              <p>{t("developments.stripSubtitle")}</p>
            </Reveal>
            <div className="home-developments__grid">
              {developments.map((development, index) => (
                <Reveal key={development.id} delay={index * 80}>
                  <DevelopmentCard development={development} />
                </Reveal>
              ))}
            </div>
            <div className="home-developments__more">
              <Link to="/desarrollos" className="btn btn-outline">{t("developments.viewAll")}</Link>
            </div>
          </div>
        </section>
      )}

      <section className="section home-tools">
        <div className="container">
          <Reveal className="section-heading">
            <span className="section-heading__eyebrow">{t("home.tools.eyebrow")}</span>
            <h2>{t("home.tools.title")}</h2>
          </Reveal>
          <ul className="home-tools__list">
            {tools.map((tool, index) => (
              <li key={tool.key}>
                <Reveal delay={index * 80} className="home-tools__reveal">
                  <Link to={tool.to} className="card home-tools__card">
                    <h3>{t(`home.tools.${tool.key}.title`)}</h3>
                    <p>{t(`home.tools.${tool.key}.text`)}</p>
                    <span className="home-tools__cta">{t("home.tools.cta")} &rarr;</span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
