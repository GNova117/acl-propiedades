import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { BUYER_GUIDE } from "../lib/buyerGuide";
import { isValidPhone, sendLead } from "../lib/lead";
import "./PublicForms.css";

// Guía del comprador en PDF a cambio de nombre y teléfono. El PDF se arma en
// el navegador sobre la hoja membretada (buyerGuidePdf.js, se carga solo al
// descargar para no meter pdf-lib en la página). El dato entra como un
// mensaje más (canal "guia") y se vuelve prospecto "sitio" como los demás.
const initialLead = { name: "", phone: "", empresa: "" };

export default function BuyerGuide() {
  const { t } = useTranslation();
  const [lead, setLead] = useState(initialLead);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | done | error | pdfError
  const [downloading, setDownloading] = useState(false);

  const changeLead = (e) => setLead((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadBuyerGuidePdf } = await import("../lib/buyerGuidePdf");
      await downloadBuyerGuidePdf();
      return true;
    } catch {
      return false;
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!lead.name.trim()) next.name = t("contact.required");
    if (!lead.phone.trim()) next.phone = t("contact.required");
    else if (!isValidPhone(lead.phone)) next.phone = t("contactRequest.invalidPhone");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("sending");
    const outcome = await sendLead({
      rateKey: "acl_guia_last_submit",
      honeypot: lead.empresa,
      name: lead.name,
      phone: lead.phone,
      message: "Descargó la Guía del comprador.",
      channel: "guia",
      details: null,
    });
    // Con "rateLimited" esta persona ya dejó sus datos hace un momento: se le
    // entrega la guía de todos modos en vez de pedirle que espere.
    if (outcome === "error") {
      setStatus("error");
      return;
    }
    setStatus((await download()) ? "done" : "pdfError");
    setLead(initialLead);
  };

  const finished = status === "done" || status === "pdfError";

  return (
    <>
      <Seo title={t("buyerGuide.seoTitle")} description={t("buyerGuide.subtitle")} />
      <div className="container public-form-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h1 style={{ fontSize: "2rem" }}>{t("buyerGuide.title")}</h1>
          <p>{t("buyerGuide.subtitle")}</p>
        </div>

        <div className="card public-form-card">
          <h2 style={{ marginTop: 0 }}>{t("buyerGuide.includesTitle")}</h2>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.35rem" }}>
            {BUYER_GUIDE.sections.map((section) => (
              <li key={section.title}>{section.title.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ul>
          <p className="form-hint">{t("buyerGuide.spanishNote")}</p>
        </div>

        <div className="card public-form-card" style={{ marginTop: "1.5rem" }}>
          {finished ? (
            <>
              <p className="form-hint" style={{ color: status === "done" ? "var(--color-success)" : "var(--color-danger)" }}>
                {status === "done" ? t("buyerGuide.success") : t("buyerGuide.pdfError")}
              </p>
              <button type="button" className="btn btn-primary btn-block" onClick={download} disabled={downloading}>
                {downloading ? <span className="spinner" /> : null}
                {t("buyerGuide.downloadAgain")}
              </button>
              <p className="form-hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                <Link to="/comparar-creditos">{t("buyerGuide.nextStep")}</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h2 style={{ marginTop: 0 }}>{t("buyerGuide.formTitle")}</h2>
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
                <label htmlFor="bg-empresa">Empresa</label>
                <input id="bg-empresa" name="empresa" value={lead.empresa} onChange={changeLead} tabIndex={-1} autoComplete="off" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="bg-name">{t("contact.name")}</label>
                  <input id="bg-name" name="name" autoComplete="name" value={lead.name} onChange={changeLead} aria-invalid={Boolean(errors.name)} />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="bg-phone">{t("contact.phone")}</label>
                  <input
                    id="bg-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={t("contactRequest.phonePlaceholder")}
                    value={lead.phone}
                    onChange={changeLead}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {errors.phone && <span className="form-error">{errors.phone}</span>}
                </div>
              </div>
              {status === "error" && <p className="form-error">{t("contact.error")}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
                {status === "sending" ? <span className="spinner" /> : null}
                {status === "sending" ? t("buyerGuide.preparing") : t("buyerGuide.submit")}
              </button>
              <p className="form-hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                {t("contact.privacyNotice")} <Link to="/aviso-de-privacidad">{t("contact.privacyLinkLabel")}</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
