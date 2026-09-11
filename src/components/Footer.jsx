import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import "./Footer.css";

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14.5 21v-7.5H17l.5-3.3h-3V8.1c0-.95.3-1.6 1.7-1.6H17.6V3.5c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.8v2.9H7v3.3h3.1V21h4.4z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="9" width="3.5" height="11" rx="0.5" />
      <circle cx="4.75" cy="4.5" r="2.2" />
      <path d="M10 9h3.4v1.9c.7-1.3 2.2-2.2 4-2.2 3.4 0 5.1 2.2 5.1 5.9V20h-3.5v-5.9c0-1.9-.7-3.1-2.3-3.1-1.3 0-2 .9-2.4 1.8-.15.35-.2.85-.2 1.35V20H10V9z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.902.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.908.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

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
            <a href="https://www.facebook.com/Aclpropiedadess/" target="_blank" rel="noreferrer" aria-label="Facebook">
              <FacebookIcon />
            </a>
            {/* Pendiente: falta el link real de LinkedIn — sin href hasta tenerlo */}
            <a aria-label="LinkedIn">
              <LinkedInIcon />
            </a>
            <a href="https://wa.me/528713243271" target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <WhatsAppIcon />
            </a>
          </div>
        </div>
      </div>

      <div className="container site-footer__legal">
        <p>{t("footer.creditNotice")}</p>
      </div>

      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-row">
          <span>&copy; {year} ACL Propiedades. {t("footer.rights")}</span>
          <NavLink to="/aviso-de-privacidad">{t("footer.privacyLink")}</NavLink>
          <NavLink to="/carta-de-derechos">{t("footer.rightsLink")}</NavLink>
        </div>
      </div>
    </footer>
  );
}
