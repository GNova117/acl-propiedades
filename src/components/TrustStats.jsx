import { useTranslation } from "react-i18next";
import PropertyCard from "./PropertyCard";
import Reveal from "./Reveal";
import "./TrustStats.css";

// Cifras de confianza del inicio y las vendidas más recientes. `summary` viene
// de buildTrustSummary(); si es null (aún pocas ventas) no se muestra nada.
export default function TrustStats({ summary }) {
  const { t } = useTranslation();
  if (!summary) return null;

  const stats = [
    { value: summary.sold, label: t("trust.sold", { count: summary.sold }) },
    summary.soldLastYear && { value: summary.soldLastYear, label: t("trust.soldLastYear", { count: summary.soldLastYear }) },
    summary.avgDays && { value: summary.avgDays, label: t("trust.avgDays") },
    summary.available && { value: summary.available, label: t("trust.available", { count: summary.available }) },
  ].filter(Boolean);

  return (
    <section className="section trust-stats">
      <div className="container">
        <Reveal className="section-heading">
          <span className="section-heading__eyebrow">{t("trust.eyebrow")}</span>
          <h2>{t("trust.title")}</h2>
        </Reveal>

        <ul className="trust-stats__list">
          {stats.map((stat) => (
            <li key={stat.label} className="trust-stats__item">
              <strong>{stat.value.toLocaleString()}</strong>
              <span>{stat.label}</span>
            </li>
          ))}
        </ul>

        {summary.recentSold.length > 0 && (
          <>
            <h3 className="trust-stats__recent-title">{t("trust.recentTitle")}</h3>
            <div className="trust-stats__recent">
              {summary.recentSold.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
