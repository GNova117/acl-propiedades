import { useTranslation } from "react-i18next";
import "./AdvisorCard.css";

export default function AdvisorCard({ advisor }) {
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
          href={`https://wa.me/${advisor.whatsapp}`}
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
