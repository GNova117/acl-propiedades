import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import "./Footer.css";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo variant="white" size="md" />
          <p>{t("footer.tagline")}</p>
        </div>

        <div>
          <h4>{t("footer.quickLinks")}</h4>
          <ul className="site-footer__links">
            <li><NavLink to="/">{t("nav.home")}</NavLink></li>
            <li><NavLink to="/propiedades">{t("nav.properties")}</NavLink></li>
            <li><NavLink to="/calculadora">{t("nav.calculator")}</NavLink></li>
            <li><NavLink to="/nosotros">{t("nav.about")}</NavLink></li>
            <li><NavLink to="/contacto">{t("nav.contact")}</NavLink></li>
          </ul>
        </div>

        <div>
          <h4>{t("footer.contactInfo")}</h4>
          <ul className="site-footer__links">
            <li>Blvd. Independencia, Local 16, Plaza San Luciano</li>
            <li>Torreón, Coahuila</li>
            <li><a href="tel:+528713243271">871 324 3271</a></li>
            <li><a href="mailto:inmobiliaria@aclpropiedades.com">inmobiliaria@aclpropiedades.com</a></li>
          </ul>
        </div>

        <div>
          <h4>{t("footer.followUs")}</h4>
          <div className="site-footer__social">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">FB</a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">IG</a>
            <a href="https://wa.me/528713243271" target="_blank" rel="noreferrer" aria-label="WhatsApp">WA</a>
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <div className="container">
          &copy; {year} ACL Propiedades. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
