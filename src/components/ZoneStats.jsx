import { useTranslation } from "react-i18next";
import { formatMXN } from "../lib/format";
import "./ZoneStats.css";

// Franja de mercado de la página de una ciudad (/propiedades/zona/:ciudad):
// cuántas propiedades hay y cuánto cuesta lo típico. Viene de
// cityMarketSummary(); sin resumen (ciudad sin propiedades) no se pinta.
export default function ZoneStats({ summary, city }) {
  const { t } = useTranslation();
  if (!summary) return null;

  const items = [
    { value: summary.available, label: t("zoneStats.available", { count: summary.available }) },
    summary.medianPrice && { value: formatMXN(summary.medianPrice), label: t("zoneStats.medianPrice") },
    summary.casaPerM2 && { value: formatMXN(summary.casaPerM2), label: t("zoneStats.casaPerM2") },
    summary.departamentoPerM2 && { value: formatMXN(summary.departamentoPerM2), label: t("zoneStats.departamentoPerM2") },
  ].filter(Boolean);

  return (
    <section className="zone-stats" aria-label={t("zoneStats.title", { city })}>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
