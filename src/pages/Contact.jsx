import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import ContactForm from "../components/ContactForm";
import "./Contact.css";

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
