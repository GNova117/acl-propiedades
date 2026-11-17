import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageToggle from "../components/LanguageToggle";
import { db } from "../lib/dataStore";
import { surveyOutcome } from "../lib/visitSurvey";
import "./PublicVisitReport.css";
import "./PublicSurvey.css";

// Enlace a «Escribir una reseña» de Google (opcional: VITE_GOOGLE_REVIEW_URL). Sin él, la invitación a reseñar no se muestra.
const GOOGLE_REVIEW_URL = import.meta.env.VITE_GOOGLE_REVIEW_URL || "";
const COMMENT_MAX = 500;

// Página pública /opinion/<token>: el cliente califica su visita (1 a 5) y puede dejar un comentario. El token es el
// de su visita (/visita/<token>); la visita debe estar «realizada». Una sola respuesta por visita. Vive FUERA de
// PublicLayout, igual que /visita/ e /informe/: ese layout manda cada ruta a Google Analytics y el token no debe llegar ahí.
export default function PublicSurvey() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [state, setState] = useState({ token: null, status: "loading", data: null });
  const current = state.token === token ? state : { status: "loading", data: null };
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null); // { rating } al enviar

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    const previousTitle = document.title;
    document.title = `${t("survey.pageTitle")} | ACL Propiedades`;
    return () => {
      robots.remove();
      referrer.remove();
      document.title = previousTitle;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    db.getVisitSurvey(token)
      .then((data) => !cancelled && setState({ token, status: data?.status || "invalido", data }))
      .catch(() => !cancelled && setState({ token, status: "error", data: null }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError(t("survey.pickRating"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await db.submitVisitFeedback(token, rating, comment.trim() || null);
      if (result?.ok) setSent({ rating });
      else if (result?.error === "already_answered") setState({ token, status: "respondida", data: current.data });
      else setError(t(`survey.errors.${result?.error}`, { defaultValue: t("survey.errors.generic") }));
    } catch {
      setError(t("survey.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const property = current.data?.property;
  const label = property ? (property.code ? `${property.title} (${property.code})` : property.title) : "";
  const shown = hover || rating;
  const outcome = sent ? surveyOutcome(sent.rating, { googleReviewUrl: GOOGLE_REVIEW_URL }) : null;

  return (
    <div className="public-report public-survey">
      <header className="public-report__bar">
        <Link to="/" className="public-report__logo" aria-label="ACL Propiedades">
          <Logo size="sm" />
        </Link>
        <div className="public-report__tools">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="public-survey__main">
        {current.status === "loading" && <p className="public-report__status">{t("common.loading")}</p>}

        {["invalido", "error", "no_disponible", "respondida"].includes(current.status) && !sent && (
          <div className="card public-report__notice">
            <h1>{t(`survey.notice.${current.status}.title`)}</h1>
            <p>{t(`survey.notice.${current.status}.body`)}</p>
          </div>
        )}

        {current.status === "ok" && !sent && (
          <form className="card public-survey__card" onSubmit={submit} noValidate>
            <h1>{t("survey.title")}</h1>
            {label && <p className="public-survey__property">{label}</p>}
            <p>{t("survey.intro")}</p>

            <fieldset className="public-survey__stars">
              <legend>{t("survey.ratingLabel")}</legend>
              <div role="radiogroup" aria-label={t("survey.ratingLabel")} onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={t("survey.starAria", { count: value })}
                    className={`public-survey__star${value <= shown ? " is-on" : ""}`}
                    onClick={() => {
                      setRating(value);
                      setError("");
                    }}
                    onMouseEnter={() => setHover(value)}
                  >
                    ★
                  </button>
                ))}
              </div>
              {shown > 0 && <span className="public-survey__word">{t(`survey.words.${shown}`)}</span>}
            </fieldset>

            <div className="form-field">
              <label htmlFor="survey-comment">{t("survey.commentLabel")}</label>
              <textarea id="survey-comment" rows={4} maxLength={COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("survey.commentPlaceholder")} />
              <span className="form-hint">{t("survey.privacy")}</span>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {t("survey.submit")}
            </button>
          </form>
        )}

        {sent && (
          <div className="card public-survey__card" role="status">
            <h1>{t("survey.thanksTitle")}</h1>
            <p>{t(outcome.invite ? "survey.thanksHappy" : "survey.thanksOther")}</p>
            {outcome.invite && (
              <a className="btn btn-primary" href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                {t("survey.googleCta")}
              </a>
            )}
            <Link to="/" className="btn btn-outline">{t("survey.backHome")}</Link>
          </div>
        )}
      </main>
    </div>
  );
}
