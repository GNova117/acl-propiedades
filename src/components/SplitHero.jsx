import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./SplitHero.css";

const PANELS = [
  { key: "properties", path: "/propiedades", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80" },
  { key: "industrial", path: "/naves-industriales", image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1400&q=80" },
];

// Primer bloque de la página de inicio: dos accesos directos gigantes,
// Propiedades / Naves Industriales, con la animación de "crecer" al pasar
// el cursor (o al enfocar con teclado) — controlado con estado de React en
// vez de :has() en CSS, para no depender de soporte de navegador reciente.
export default function SplitHero() {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);

  return (
    <section className="split-hero">
      {PANELS.map((panel) => {
        const isHovered = hovered === panel.key;
        const isDimmed = hovered !== null && !isHovered;
        return (
          <Link
            key={panel.key}
            to={panel.path}
            className={`split-hero__panel ${isHovered ? "split-hero__panel--grow" : ""} ${isDimmed ? "split-hero__panel--shrink" : ""}`}
            onMouseEnter={() => setHovered(panel.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(panel.key)}
            onBlur={() => setHovered(null)}
          >
            <div className="split-hero__image" style={{ backgroundImage: `url(${panel.image})` }} />
            <div className="split-hero__overlay" />
            <div className="split-hero__content">
              <h2>{t(`splitHero.${panel.key}.title`)}</h2>
              <p>{t(`splitHero.${panel.key}.subtitle`)}</p>
              <span className="split-hero__cta">{t("splitHero.cta")}</span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
