import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import Reveal from "../components/Reveal";
import Stars from "../components/Stars";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import GoogleReviews from "../components/GoogleReviews";
import { db } from "../lib/dataStore";
import "./Home.css";
import "./Testimonials.css";

// 302: el inicio solo muestra los primeros testimonios; esta página los trae todos, y debajo van las reseñas de Google.
export default function Testimonials() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.getTestimonials()
      .then((data) => active && setItems(data.filter((item) => item.active)))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Seo title={t("testimonials.pageTitle")} description={t("testimonials.pageSeoDescription")} />
      <section className="section">
        <div className="container">
          <Reveal className="section-heading">
            <span className="section-heading__eyebrow">{t("testimonials.homeEyebrow")}</span>
            <h1>{t("testimonials.pageTitle")}</h1>
            <p>{t("testimonials.pageSubtitle")}</p>
          </Reveal>
          {loading ? (
            <LoadingState variant="lines" />
          ) : items.length === 0 ? (
            <EmptyState illustration="heart" title={t("testimonials.pageEmptyTitle")} text={t("testimonials.pageEmptyText")}>
              <Link to="/propiedades" className="btn btn-primary">{t("featured.cta")}</Link>
            </EmptyState>
          ) : (
            <div className="testimonials-page__grid">
              {items.map((testimonial) => (
                <div key={testimonial.id} className="card testimonial-card">
                  <Stars rating={testimonial.rating} />
                  <p className="testimonial-card__quote">&ldquo;{testimonial.quote}&rdquo;</p>
                  <p className="testimonial-card__name">{testimonial.name}</p>
                  {testimonial.role && <p className="testimonial-card__role">{testimonial.role}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <GoogleReviews />
    </>
  );
}
