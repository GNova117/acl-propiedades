import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import SearchBar from "../components/SearchBar";
import CategoryCard from "../components/CategoryCard";
import { db } from "../lib/dataStore";
import { PROPERTY_TYPES } from "../lib/format";
import "./Home.css";

export default function Home() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState({ casa: 0, departamento: 0, nave_industrial: 0, terreno: 0 });

  useEffect(() => {
    let active = true;
    db.getProperties({ activeOnly: true }).then((properties) => {
      if (!active) return;
      const next = { casa: 0, departamento: 0, nave_industrial: 0, terreno: 0 };
      properties.forEach((p) => {
        if (next[p.type] != null) next[p.type] += 1;
      });
      setCounts(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Seo
        title={t("nav.home")}
        description="ACL Propiedades: compra y venta de casas, departamentos, naves industriales y terrenos en Torreón, Gómez Palacio y Lerdo."
      />

      <section className="hero">
        <div className="hero__overlay" />
        <div className="container hero__content">
          <h1>{t("hero.title")}</h1>
          <p>{t("hero.subtitle")}</p>
          <SearchBar />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <span className="section-heading__eyebrow">{t("categories.eyebrow")}</span>
            <h2>{t("categories.title")}</h2>
          </div>
          <div className="home-categories">
            {PROPERTY_TYPES.map((type) => (
              <CategoryCard key={type} type={type} count={counts[type]} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
