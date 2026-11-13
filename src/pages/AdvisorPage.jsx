import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import PropertyCard from "../components/PropertyCard";
import { db } from "../lib/dataStore";
import { advisorGreeting, advisorProperties, advisorShareText, advisorUrl, advisorWhatsappHref, buildVCard, isPublicAdvisor, vcardFileName } from "../lib/advisorPage";
import { whatsappDigits } from "../lib/format";
import { isValidPhone, sendLead } from "../lib/lead";
import "./AdvisorPage.css";

const EMPTY = { name: "", phone: "", message: "", empresa: "" };

// La tarjeta digital del asesor (/asesor/<slug>, pública): su foto y datos, botones para escribirle, llamarle y guardar su contacto
// en el teléfono, sus propiedades disponibles y un formulario corto. Lo que escriban desde aquí llega a ESE asesor (se guarda con su
// advisor_id: aviso por WhatsApp y push, y al volverlo prospecto se le asigna a él). Sin login.
export default function AdvisorPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const [state, setState] = useState({ slug: null, status: "loading", advisor: null, properties: [] });
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [outcome, setOutcome] = useState("idle"); // idle | sending | success | rateLimited | error
  const [copied, setCopied] = useState(false);
  const current = state.slug === slug ? state : { status: "loading", advisor: null, properties: [] };

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.getAdvisorBySlug(slug), db.getProperties({}).catch(() => [])])
      .then(([advisor, properties]) => {
        if (cancelled) return;
        if (!advisor || !isPublicAdvisor(advisor)) setState({ slug, status: "notfound", advisor: null, properties: [] });
        else setState({ slug, status: "ok", advisor, properties: advisorProperties(properties, advisor.id) });
      })
      .catch(() => !cancelled && setState({ slug, status: "error", advisor: null, properties: [] }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const advisor = current.advisor;
  const url = useMemo(() => (advisor ? advisorUrl(advisor, window.location.origin) : null), [advisor]);

  if (current.status === "loading") return <div className="container advisor-page"><p className="form-hint" role="status">{t("common.loading")}</p></div>;

  if (current.status !== "ok") {
    return (
      <div className="container advisor-page">
        <Seo title={t("advisorPage.notFoundTitle")} />
        <div className="card advisor-page__notice">
          <h1>{t(current.status === "error" ? "advisorPage.errorTitle" : "advisorPage.notFoundTitle")}</h1>
          <p>{t(current.status === "error" ? "advisorPage.errorBody" : "advisorPage.notFoundBody")}</p>
          <Link className="btn btn-primary" to="/nosotros">
            {t("advisorPage.seeTeam")}
          </Link>
        </div>
      </div>
    );
  }

  const first = advisor.name.trim().split(/\s+/)[0];
  const whatsapp = advisorWhatsappHref(advisor, advisorGreeting(advisor));
  const phone = whatsappDigits(advisor.phone);

  const saveContact = () => {
    const blob = new Blob([buildVCard(advisor, { url })], { type: "text/vcard;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = vcardFileName(advisor);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const share = async () => {
    const text = advisorShareText(advisor, url);
    if (navigator.share) {
      try {
        await navigator.share({ title: advisor.name, text, url });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("advisorPage.copyManual"), url);
    }
  };

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = t("advisorPage.form.required");
    if (!form.phone.trim()) next.phone = t("advisorPage.form.required");
    else if (!isValidPhone(form.phone)) next.phone = t("advisorPage.form.invalidPhone");
    if (!form.message.trim()) next.message = t("advisorPage.form.required");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setOutcome("sending");
    const result = await sendLead({
      rateKey: "acl_advisor_last_submit",
      honeypot: form.empresa,
      name: form.name,
      phone: form.phone,
      message: form.message.trim(),
      channel: "asesor",
      details: { advisor_slug: advisor.slug },
      advisorId: advisor.id,
    });
    setOutcome(result);
    if (result === "success") setForm(EMPTY);
  };

  return (
    <div className="container advisor-page">
      <Seo title={advisor.name} description={advisor.bio || t("advisorPage.seoDescription", { name: advisor.name })} image={advisor.photo_url || undefined} />

      <section className="card advisor-page__hero" aria-labelledby="advisor-page-name">
        {advisor.photo_url && <img className="advisor-page__photo" src={advisor.photo_url} alt={advisor.name} />}
        <div className="advisor-page__who">
          <h1 id="advisor-page-name">{advisor.name}</h1>
          <p className="advisor-page__role">{advisor.bio || t("advisorPage.defaultRole")}</p>
          <p className="form-hint">ACL Propiedades</p>
        </div>
        <div className="advisor-page__actions">
          {whatsapp && (
            <a className="btn btn-primary" href={whatsapp} target="_blank" rel="noopener noreferrer">
              {t("advisorPage.whatsapp")}
            </a>
          )}
          {phone && (
            <a className="btn btn-outline" href={`tel:${phone}`}>
              {t("advisorPage.call")}
            </a>
          )}
          {advisor.email && (
            <a className="btn btn-outline" href={`mailto:${advisor.email}`}>
              {t("advisorPage.email")}
            </a>
          )}
          <button type="button" className="btn btn-outline" onClick={saveContact}>
            {t("advisorPage.saveContact")}
          </button>
          <button type="button" className="btn btn-outline" onClick={share}>
            {copied ? t("advisorPage.copied") : t("advisorPage.share")}
          </button>
        </div>
      </section>

      <section className="advisor-page__section" aria-labelledby="advisor-page-props">
        <h2 id="advisor-page-props">{t("advisorPage.propertiesTitle", { name: first })}</h2>
        {current.properties.length === 0 ? (
          <p className="card advisor-page__empty">{t("advisorPage.noProperties")}</p>
        ) : (
          <div className="advisor-page__grid">
            {current.properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
        <p>
          <Link to="/propiedades">{t("advisorPage.viewAll")}</Link>
        </p>
      </section>

      <section className="card advisor-page__form" aria-labelledby="advisor-page-form">
        <h2 id="advisor-page-form">{t("advisorPage.form.title", { name: first })}</h2>
        {outcome === "success" ? (
          <>
            <p className="advisor-page__ok" role="status">
              {t("advisorPage.form.success", { name: first })}
            </p>
            <button type="button" className="btn btn-outline" onClick={() => setOutcome("idle")}>
              {t("advisorPage.form.another")}
            </button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
              <label htmlFor="ap-empresa">Empresa</label>
              <input id="ap-empresa" name="empresa" value={form.empresa} onChange={change} tabIndex={-1} autoComplete="off" />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="ap-name">{t("advisorPage.form.name")} *</label>
                <input id="ap-name" name="name" autoComplete="name" value={form.name} onChange={change} aria-invalid={Boolean(errors.name)} />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="ap-phone">{t("advisorPage.form.phone")} *</label>
                <input id="ap-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={change} aria-invalid={Boolean(errors.phone)} />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="ap-message">{t("advisorPage.form.message")} *</label>
              <textarea id="ap-message" name="message" rows={4} maxLength={1000} value={form.message} onChange={change} placeholder={t("advisorPage.form.messagePlaceholder")} aria-invalid={Boolean(errors.message)} />
              {errors.message && <span className="form-error">{errors.message}</span>}
            </div>
            {(outcome === "rateLimited" || outcome === "error") && (
              <p className="form-error" role="alert">
                {t(outcome === "rateLimited" ? "advisorPage.form.rateLimited" : "advisorPage.form.error")}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={outcome === "sending"}>
              {outcome === "sending" ? <span className="spinner" /> : null}
              {outcome === "sending" ? t("advisorPage.form.sending") : t("advisorPage.form.send")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
