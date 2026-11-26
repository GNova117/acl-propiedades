import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { browserVideoConditions, heroMedia, shouldPlayVideo } from "../lib/heroMedia";
import "./SplitHero.css";

// Foto o video propio de La Laguna (variables VITE_HERO_*, ver lib/heroMedia.js): reemplaza a la foto de stock del panel
// «Propiedades». Sin ellas, todo queda como siempre.
const HERO = heroMedia(import.meta.env);

const PANELS = [
  { key: "properties", path: "/propiedades", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80" },
  { key: "industrial", path: "/naves-industriales", image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1400&q=80", typeKey: "nave_industrial" },
];

// Primer bloque de la página de inicio: dos accesos directos gigantes,
// Propiedades / Naves Industriales, con la animación de "crecer" al pasar
// el cursor (o al enfocar con teclado) — controlado con estado de React en
// vez de :has() en CSS, para no depender de soporte de navegador reciente.
// `propertyTypes` (de property_types, administrable desde /admin/zonas) da
// la imagen y el estado activo/inactivo del panel que sí corresponde a un
// tipo (Naves Industriales); "Propiedades" no mapea a un solo tipo y se
// queda con su imagen fija. `counts`: propiedades por tipo (null mientras cargan).
export default function SplitHero({ propertyTypes = [], counts = null }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);
  // El video solo se reproduce si la persona no pidió menos movimiento, no ahorra datos y la conexión aguanta.
  const playVideo = Boolean(HERO.video) && shouldPlayVideo(browserVideoConditions());

  const panels = PANELS.map((panel) => {
    if (!panel.typeKey) return { ...panel, image: HERO.image || panel.image, video: playVideo ? HERO.video : null, poster: HERO.poster, active: true };
    const type = propertyTypes.find((pt) => pt.key === panel.typeKey);
    // Un tipo activo pero sin ninguna propiedad publicada también se anuncia como «Próximamente»: el menú ya lo esconde y el inicio no
    // debe llevar a un listado vacío. Mientras no llegan los conteos se asume que sí tiene.
    const hasProperties = !counts || counts[panel.typeKey] == null || counts[panel.typeKey] > 0;
    return { ...panel, image: type?.image_url || panel.image, active: (!type || type.active !== false) && hasProperties };
  });

  return (
    <section className="split-hero">
      {panels.map((panel) => {
        if (!panel.active) {
          return (
            <div key={panel.key} className="split-hero__panel split-hero__panel--disabled">
              <div className="split-hero__image" style={{ backgroundImage: `url(${panel.image})` }} />
              <div className="split-hero__overlay" />
              <div className="split-hero__content">
                <p className="split-hero__title">{t(`splitHero.${panel.key}.title`)}</p>
                <p>{t(`splitHero.${panel.key}.subtitle`)}</p>
                <span className="split-hero__badge">{t("splitHero.comingSoon")}</span>
              </div>
            </div>
          );
        }

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
            {panel.video && <video className="split-hero__video" src={panel.video} poster={panel.poster || undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />}
            <div className="split-hero__overlay" />
            <div className="split-hero__content">
              <p className="split-hero__title">{t(`splitHero.${panel.key}.title`)}</p>
              <p>{t(`splitHero.${panel.key}.subtitle`)}</p>
              <span className="split-hero__cta">{t("splitHero.cta")}</span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
