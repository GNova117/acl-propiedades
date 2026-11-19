import { useTranslation } from "react-i18next";
import useBusinessJsonLd from "../lib/useBusinessJsonLd";
import Seo from "../components/Seo";
import ContactForm from "../components/ContactForm";
import WhatsAppIcon from "../components/icons/WhatsAppIcon";
import "./Contact.css";
import { OFFICE } from "../lib/office";

// Los datos de la oficina salen de lib/office.js (única fuente).
const OFFICE_PHONE_DISPLAY = OFFICE.phoneDisplay;
const OFFICE_PHONE_TEL = OFFICE.phoneTel;
const OFFICE_WHATSAPP_HREF = OFFICE.whatsappUrl;
const OFFICE_EMAIL = OFFICE.email;

export default function Contact() {
  const { t } = useTranslation();
  const businessJsonLd = useBusinessJsonLd();

  return (
    <>
      <Seo title={t("nav.contact")} description={t("contact.subtitle")} jsonLd={businessJsonLd} />

      <div className="container contact-page">
        <div className="section-heading m-section">
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
                title={t("contact.mapTitle")}
                width="100%"
                height="100%"
                style={{ border: 0, borderRadius: "var(--radius-md)" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps?q=ACL+Propiedades,+Torre%C3%B3n,+Coahuila&z=16&output=embed"
              />
            </div>
            <p className="contact-page__address">
              {OFFICE.streetAddress}, {OFFICE.postalCode} {OFFICE.city}, {OFFICE.regionShort}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
