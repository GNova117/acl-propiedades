import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Reveal from "./Reveal";
import Stars from "./Stars";
import { pickReviews } from "../lib/googleReviews";
import "./GoogleReviews.css";

// Calificación y reseñas de Google de la inmobiliaria (/api/google-reviews).
// Mientras el servidor diga que NO está configurado (faltan la llave y el ID
// de Google en Vercel) se muestra un cuadro difuminado de "Próximamente", con
// tarjetas vacías: nunca reseñas ni calificaciones inventadas. Si está
// configurado pero falla, o no hay reseñas aptas, no se pinta nada. Las
// reseñas reales se muestran tal cual, con su autor y calificación y la
// atribución a Google que pide su servicio.
export default function GoogleReviews() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [comingSoon, setComingSoon] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/google-reviews", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.configured === false) setComingSoon(true);
        else if (json?.configured && json.available) setData(json);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (comingSoon) {
    return (
      <section className="section">
        <div className="container">
          <Reveal className="section-heading">
            <span className="section-heading__eyebrow">{t("googleReviews.eyebrow")}</span>
            <h2>{t("googleReviews.title")}</h2>
          </Reveal>
          <div className="google-reviews__teaser">
            <div className="google-reviews__skeleton" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div className="card google-reviews__skeleton-card" key={i}>
                  <span className="google-reviews__bar google-reviews__bar--stars" />
                  <span className="google-reviews__bar" />
                  <span className="google-reviews__bar" />
                  <span className="google-reviews__bar google-reviews__bar--short" />
                  <span className="google-reviews__bar google-reviews__bar--name" />
                </div>
              ))}
            </div>
            <div className="google-reviews__soon">
              <strong>{t("googleReviews.soon")}</strong>
              <span>{t("googleReviews.soonText")}</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!data) return null;
  const reviews = pickReviews(data.reviews);
  if (reviews.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-heading">
          <span className="section-heading__eyebrow">{t("googleReviews.eyebrow")}</span>
          <h2>{t("googleReviews.title")}</h2>
          <p className="google-reviews__summary">
            <strong>{data.rating.toFixed(1)}</strong> <Stars rating={Math.round(data.rating)} />
            {data.total ? <span> · {t("googleReviews.total", { count: data.total })}</span> : null}
          </p>
        </Reveal>
        <div className="testimonials-grid">
          {reviews.map((review, index) => (
            <Reveal key={`${review.author}-${index}`} delay={index * 70}>
              <div className="card testimonial-card">
                <Stars rating={review.rating} />
                <p className="testimonial-card__quote">&ldquo;{review.text}&rdquo;</p>
                <p className="testimonial-card__name">
                  {review.authorUrl ? (
                    <a href={review.authorUrl} target="_blank" rel="noopener noreferrer">{review.author}</a>
                  ) : (
                    review.author
                  )}
                </p>
                {review.when && <p className="testimonial-card__role">{review.when}</p>}
              </div>
            </Reveal>
          ))}
        </div>
        {data.url && (
          <p className="google-reviews__more">
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">{t("googleReviews.seeAll")}</a>
          </p>
        )}
        <p className="form-hint google-reviews__attribution">{t("googleReviews.attribution")}</p>
      </div>
    </section>
  );
}
