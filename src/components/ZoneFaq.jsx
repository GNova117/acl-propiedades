import { useTranslation } from "react-i18next";
import "./ZoneFaq.css";

// Preguntas frecuentes de una ciudad o colonia: texto propio (no solo el listado) para que la página tenga contenido que responder.
// Las cifras salen del mercado real de ese momento (propiedades disponibles y precio mediano); sin datos, la respuesta no inventa nada.
export function buildZoneFaq(t, { place, summary, formatPrice }) {
  const count = summary?.available;
  return [
    [
      t("zoneFaq.whatQ", { place }),
      count ? t("zoneFaq.whatA", { place, count }) : t("zoneFaq.whatANone", { place }),
    ],
    [
      t("zoneFaq.priceQ", { place }),
      summary?.medianPrice ? t("zoneFaq.priceA", { place, price: formatPrice(summary.medianPrice) }) : t("zoneFaq.priceANone", { place }),
    ],
    [t("zoneFaq.creditQ"), t("zoneFaq.creditA")],
    [t("zoneFaq.visitQ"), t("zoneFaq.visitA")],
  ];
}

export default function ZoneFaq({ place, pairs }) {
  const { t } = useTranslation();
  return (
    <section className="zone-faq" aria-labelledby="zone-faq-title">
      <h2 id="zone-faq-title">{t("zoneFaq.title", { place })}</h2>
      {pairs.map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </section>
  );
}
