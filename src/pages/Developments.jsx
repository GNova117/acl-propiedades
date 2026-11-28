import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import Reveal from "../components/Reveal";
import DevelopmentCard from "../components/DevelopmentCard";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { db } from "../lib/dataStore";
import "./Developments.css";

// 270/316: página que lista todos los desarrollos (torres y proyectos con varios departamentos). Hasta ahora solo existían
// la tira del listado de propiedades y la ficha de cada desarrollo; no había a dónde llevar «Ver todos» ni un enlace en el menú.
export default function Developments() {
  const { t } = useTranslation();
  const [developments, setDevelopments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.getDevelopments({ publishedOnly: true })
      .then((data) => active && setDevelopments(data))
      .catch(() => active && setDevelopments([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Seo title={t("developments.listTitle")} description={t("developments.listSeoDescription")} />
      <section className="section">
        <div className="container">
          <Reveal className="section-heading">
            <span className="section-heading__eyebrow">{t("developments.eyebrow")}</span>
            <h1>{t("developments.listTitle")}</h1>
            <p>{t("developments.stripSubtitle")}</p>
          </Reveal>
          {loading ? (
            <LoadingState variant="lines" />
          ) : developments.length === 0 ? (
            <EmptyState illustration="search" title={t("developments.listEmptyTitle")} text={t("developments.listEmptyText")}>
              <Link to="/propiedades" className="btn btn-primary">{t("developments.backToProperties")}</Link>
            </EmptyState>
          ) : (
            <div className="developments-page__grid">
              {developments.map((development) => (
                <DevelopmentCard key={development.id} development={development} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
