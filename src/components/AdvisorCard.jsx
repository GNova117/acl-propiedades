import { useTranslation } from "react-i18next";
import { whatsappDigits } from "../lib/format";
import "./AdvisorCard.css";

// `property`: opcional — cuando la tarjeta se muestra en la ficha de una
// propiedad (no en /nosotros, donde no aplica), precarga el WhatsApp con
// el código/título y el link directo, para que el asesor sepa de qué
// propiedad se trata sin tener que preguntar.
function buildWhatsappHref(advisor, property) {
  const number = whatsappDigits(advisor.whatsapp);
  if (!property) return `https://wa.me/${number}`;
  const url = `${window.location.origin}/propiedades/${property.id}`;
  const title = property.title.trim();
  const label = property.code ? `${title} (${property.code})` : title;
  const text = `Hola, me interesa la propiedad ${label} — ${url}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export default function AdvisorCard({ advisor, property }) {
  const { t } = useTranslation();
  if (!advisor) return null;

  return (
    <div className="advisor-card card">
      <img src={advisor.photo_url} alt={advisor.name} className="advisor-card__photo" />
      <h4>{advisor.name}</h4>
      {advisor.bio && <p className="advisor-card__bio">{advisor.bio}</p>}
      <div className="advisor-card__actions">
        <a href={`tel:${advisor.phone}`} className="btn btn-outline btn-sm btn-block">
          {t("detail.call")}
        </a>
        <a
          href={buildWhatsappHref(advisor, property)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm btn-block"
        >
          {t("detail.whatsapp")}
        </a>
        <a href={`mailto:${advisor.email}`} className="btn btn-outline btn-sm btn-block">
          {t("detail.email")}
        </a>
      </div>
    </div>
  );
}
