import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import ContactForm from "../components/ContactForm";
import WhatsAppIcon from "../components/icons/WhatsAppIcon";
import "./Contact.css";

// Mismo número y formato que ya usan Footer.jsx y FloatingWhatsApp.jsx —
// una sola fuente hubiera sido mejor desde el inicio, pero no vale la pena
// tocar esos dos archivos ya probados solo para extraer una constante.
const OFFICE_PHONE_DISPLAY = "871 324 3271";
const OFFICE_PHONE_TEL = "+528713243271";
const OFFICE_WHATSAPP_HREF = "https://wa.me/528713243271";
const OFFICE_EMAIL = "inmobiliaria@aclpropiedades.com";

export default function Contact() {
  const { t } = useTranslation();

  return (
    <>
      <Seo title={t("nav.contact")} description={t("contact.subtitle")} />

      <div className="container contact-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h2>{t("contact.title")}</h2>
          <p>{t("contact.subtitle")}</p>
        </div>

        <div className="contact-page__layout">
          <ContactForm />
          <div className="contact-page__map-block">
            <div className="card contact-page__info">
              <h3>{t("contact.directTitle")}</h3>
              <ul className="contact-page__info-list">
                <li>
                  <a href={`tel:${OFFICE_PHONE_TEL}`}>{OFFICE_PHONE_DISPLAY}</a>
                </li>
                <li>
                  <a href={`mailto:${OFFICE_EMAIL}`}>{OFFICE_EMAIL}</a>
                </li>
                <li>
                  <a href={OFFICE_WHATSAPP_HREF} target="_blank" rel="noreferrer">
                    <WhatsAppIcon size={14} /> WhatsApp
                  </a>
                </li>
              </ul>
              <p className="contact-page__hours-title">{t("about.hoursTitle")}</p>
              <p className="contact-page__hours">{t("about.hours1")}</p>
              <p className="contact-page__hours">{t("about.hours2")}</p>
            </div>
            <div className="contact-page__map">
              <iframe
                title="Ubicación ACL Propiedades"
                width="100%"
                height="100%"
                style={{ border: 0, borderRadius: "var(--radius-md)" }}
                loading="lazy"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-103.4409%2C25.5555%2C-103.4009%2C25.5855&layer=mapnik&marker=25.5704828%2C-103.4209071"
              />
            </div>
            <p className="contact-page__address">
              Plaza San Luciano, Blvd. Independencia 2600-Local 16, Estrella, 27010 Torreón, Coah.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
