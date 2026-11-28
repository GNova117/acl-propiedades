import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Reveal from "./Reveal";
import "./HomeSellBanner.css";

// 315: los vendedores son la fuente del inventario y el inicio no les decía nada. Un bloque corto, sin imagen, que lleva a
// «Vende tu casa» (cuánto vale + contacto) y a la calculadora de gastos al vender.
export default function HomeSellBanner() {
  const { t } = useTranslation();
  return (
    <section className="section home-sell">
      <div className="container">
        <Reveal>
          <div className="home-sell__card">
            <div className="home-sell__text">
              <span className="section-heading__eyebrow">{t("home.sell.eyebrow")}</span>
              <h2>{t("home.sell.title")}</h2>
              <p>{t("home.sell.text")}</p>
            </div>
            <div className="home-sell__actions">
              <Link to="/vende-tu-casa" className="btn btn-primary">{t("home.sell.cta")}</Link>
              <Link to="/contacto" className="btn btn-outline">{t("home.sell.ctaSecondary")}</Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
