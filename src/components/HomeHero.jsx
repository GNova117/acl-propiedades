import { useTranslation } from "react-i18next";
import SearchBar from "./SearchBar";
import { browserVideoConditions, heroMedia, shouldPlayVideo } from "../lib/heroMedia";
import { OFFICE } from "../lib/office.js";

// Foto o video propio de La Laguna (variables VITE_HERO_*, ver lib/heroMedia.js): reemplaza a la foto de stock del fondo.
// Sin ellas, todo queda como siempre.
const HERO = heroMedia(import.meta.env);

// 264/265/320: la portada del inicio es UN solo bloque con el buscador arriba (antes eran dos paneles a pantalla completa y el
// buscador quedaba debajo del pliegue; el panel de «Naves» anunciaba algo que a veces no existe). Los accesos por tipo ya los
// da el selector del buscador y, más abajo, las tarjetas de categoría.
export default function HomeHero() {
  const { t } = useTranslation();
  // El video solo se reproduce si la persona no pidió menos movimiento, no ahorra datos y la conexión aguanta.
  const playVideo = Boolean(HERO.video) && shouldPlayVideo(browserVideoConditions());

  return (
    <section className="hero" style={HERO.image ? { backgroundImage: `url(${HERO.image})` } : undefined}>
      {playVideo && <video className="hero__video" src={HERO.video} poster={HERO.poster || undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />}
      <div className="hero__overlay" />
      <div className="container hero__content">
        <h1>{t("hero.title")}</h1>
        <p>{t("hero.subtitle")}</p>
        <SearchBar />
        <p className="hero__call">
          {t("hero.callPrompt")}{" "}
          <a href={`tel:${OFFICE.phoneTel}`}>{OFFICE.phoneDisplay}</a> · <a href={OFFICE.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </p>
      </div>
    </section>
  );
}
