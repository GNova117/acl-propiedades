import { useEffect, useState } from "react";
import { isOfficeOpen } from "../lib/officeHours";
import { useTranslation } from "react-i18next";
import useBusinessJsonLd from "../lib/useBusinessJsonLd";
import { mapsUrl } from "../lib/calendarEvent";
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
  // El mapa de Google no se descarga hasta que la persona lo pide: al cargarlo Google recibe su IP y pone cookies.
  const [showMap, setShowMap] = useState(false);
  const [open, setOpen] = useState(() => isOfficeOpen());
  useEffect(() => {
    const timer = setInterval(() => setOpen(isOfficeOpen()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Seo title={t("nav.contact")} description={t("contact.subtitle")} jsonLd={businessJsonLd} />

      <div className="container contact-page">
        <div className="section-heading m-section">
          <h1>{t("contact.title")}</h1>
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
              <p className="contact-page__hours-title">
                {t("about.hoursTitle")}{" "}
                <span className={`contact-page__open${open ? " contact-page__open--yes" : ""}`}>{open ? t("contact.openNow") : t("contact.closedNow")}</span>
              </p>
              <p className="contact-page__hours">{t("about.hours1")}</p>
              <p className="contact-page__hours">{t("about.hours2")}</p>
            </div>
            <div className="contact-page__map">
              {showMap ? (
                <iframe
                  title={t("contact.mapTitle")}
                  width="100%"
                  height="100%"
                  style={{ border: 0, borderRadius: "var(--radius-md)" }}
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps?q=ACL+Propiedades,+Torre%C3%B3n,+Coahuila&z=16&output=embed"
                />
              ) : (
                <div className="contact-page__map-placeholder card">
                  <button type="button" className="btn btn-primary" onClick={() => setShowMap(true)}>
                    {t("contact.showMap")}
                  </button>
                  <p className="form-hint">{t("contact.mapNotice")}</p>
                </div>
              )}
            </div>
            <p className="contact-page__address">
              <a href={mapsUrl(`${OFFICE.streetAddress}, ${OFFICE.postalCode} ${OFFICE.city}, ${OFFICE.regionShort}`)} target="_blank" rel="noopener noreferrer">
                {OFFICE.streetAddress}, {OFFICE.postalCode} {OFFICE.city}, {OFFICE.regionShort}
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
