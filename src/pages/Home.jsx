import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import SplitHero from "../components/SplitHero";
import SearchBar from "../components/SearchBar";
import CategoryCard from "../components/CategoryCard";
import Reveal from "../components/Reveal";
import { db } from "../lib/dataStore";
import "./Home.css";

// Las tarjetas de categoría del inicio son contenido curado (imagen + copy
// propios en CategoryCard.jsx/i18n), no la lista completa de tipos — se
// quedan fijas en estos 4 aunque se agreguen más tipos desde
// /admin/zonas; un tipo nuevo solo aparece en el filtro de "/propiedades".
const HOME_CATEGORY_TYPES = ["casa", "departamento", "nave_industrial", "terreno"];

export default function Home() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState({ casa: 0, departamento: 0, nave_industrial: 0, terreno: 0 });
  const [propertyTypes, setPropertyTypes] = useState([]);

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
    db.getPropertyTypes().then((data) => {
      if (active) setPropertyTypes(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const typeByKey = (key) => propertyTypes.find((pt) => pt.key === key);

  return (
    <>
      <Seo
        title={t("nav.home")}
        description="ACL Propiedades: compra y venta de casas, departamentos, naves industriales y terrenos en Torreón, Gómez Palacio y Lerdo."
      />

      <SplitHero propertyTypes={propertyTypes} />

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
          <Reveal className="section-heading">
            <span className="section-heading__eyebrow">{t("categories.eyebrow")}</span>
            <h2>{t("categories.title")}</h2>
          </Reveal>
          <div className="home-categories">
            {HOME_CATEGORY_TYPES.map((type, index) => {
              const typeRecord = typeByKey(type);
              return (
                <Reveal key={type} delay={index * 80}>
                  <CategoryCard
                    type={type}
                    count={counts[type]}
                    active={!typeRecord || typeRecord.active !== false}
                    imageUrl={typeRecord?.image_url}
                  />
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
