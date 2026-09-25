import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { formatMXN } from "../lib/format";
import { UMA_2026, simularCreditoInfonavit } from "../lib/infonavitSimulator";
import { isValidPhone, sendLead } from "../lib/lead";
import "./PublicForms.css";

const EMPTY = { edad: 30, sexo: "hombre", salarioMensual: 12000, ssv: 0 };

// Versión pública del simulador de crédito Infonavit. Al final invita a dejar
// nombre y teléfono; llega a Mensajes (canal "simulador") con el resultado, y de
// ahí el equipo lo pasa a Prospectos.
export default function CreditSimulator() {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [lead, setLead] = useState({ name: "", phone: "", empresa: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  const result = useMemo(() => simularCreditoInfonavit(form), [form]);
  const change = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const changeLead = (e) => setLead((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const canBuy = result.capacidadTotal > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!lead.name.trim()) next.name = t("contact.required");
    if (!lead.phone.trim()) next.phone = t("contact.required");
    else if (!isValidPhone(lead.phone)) next.phone = t("contactRequest.invalidPhone");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("sending");
    const message = [
      "Simulador de crédito Infonavit — pide asesoría.",
      `Edad ${form.edad}, ${form.sexo}, salario mensual ${formatMXN(form.salarioMensual)}, ahorro SSV ${formatMXN(form.ssv)}.`,
      `Resultado: crédito ${formatMXN(result.montoCredito)} + SSV ${formatMXN(result.saldoSsv)} = capacidad ${formatMXN(result.capacidadTotal)}; cuota mensual ${formatMXN(result.pagoMensual)} a ${result.plazoAnios} años.`,
    ].join("\n");
    const outcome = await sendLead({
      rateKey: "acl_simulador_last_submit",
      honeypot: lead.empresa,
      name: lead.name,
      phone: lead.phone,
      message,
      channel: "simulador",
      details: { edad: Number(form.edad), sexo: form.sexo, salario: Number(form.salarioMensual), ssv: Number(form.ssv), capacidad: Math.round(result.capacidadTotal) },
    });
    setStatus(outcome);
    if (outcome === "success") setLead({ name: "", phone: "", empresa: "" });
  };

  return (
    <>
      <Seo title={t("creditSim.seoTitle")} description={t("creditSim.subtitle")} />
      <div className="container public-form-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h1 style={{ fontSize: "2rem" }}>{t("creditSim.title")}</h1>
          <p>{t("creditSim.subtitle")}</p>
        </div>

        <div className="card public-form-card">
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="cs-edad">{t("infonavit.age")}</label>
              <input id="cs-edad" type="number" min="18" max="99" inputMode="numeric" value={form.edad} onChange={change("edad")} />
            </div>
            <div className="form-field">
              <label htmlFor="cs-sexo">{t("infonavit.sex")}</label>
              <select id="cs-sexo" value={form.sexo} onChange={change("sexo")}>
                <option value="hombre">{t("infonavit.sexMale")}</option>
                <option value="mujer">{t("infonavit.sexFemale")}</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="cs-salario">{t("infonavit.monthlySalary")}</label>
            <input id="cs-salario" type="number" min="0" inputMode="numeric" value={form.salarioMensual} onChange={change("salarioMensual")} />
          </div>
          <div className="form-field">
            <label htmlFor="cs-ssv">{t("creditSim.ssv")}</label>
            <input id="cs-ssv" type="number" min="0" inputMode="numeric" value={form.ssv} onChange={change("ssv")} />
            <span className="form-hint">{t("creditSim.ssvHint")}</span>
          </div>

          <div className="public-form-result">
            <span className="public-form-result__label">{t("infonavit.totalCapacity")}</span>
            <span className="public-form-result__value">{formatMXN(result.capacidadTotal)}</span>
            <div className="public-form-result__rows">
              <span>
                {t("infonavit.creditAmount")}: <strong>{formatMXN(result.montoCredito)}</strong>
              </span>
              <span>
                {t("infonavit.ssvBalance")}: <strong>{formatMXN(result.saldoSsv)}</strong>
              </span>
              <span>
                {t("infonavit.monthlyPayment")}: <strong>{formatMXN(result.pagoMensual)}</strong>
              </span>
              <span>
                {t("creditSim.term")}: <strong>{t("creditSim.years", { count: result.plazoAnios })}</strong>
              </span>
            </div>
            {canBuy && (
              <Link to={`/propiedades?max=${Math.floor(result.capacidadTotal)}`} className="btn btn-outline btn-sm">
                {t("creditSim.seeProperties")}
              </Link>
            )}
            <p className="form-hint" style={{ marginBottom: 0 }}>
              {t("creditSim.disclaimer", { uma: formatMXN(UMA_2026.mensual) })}
            </p>
          </div>
        </div>

        <div className="card public-form-card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("creditSim.leadTitle")}</h2>
          <p className="form-hint">{t("creditSim.leadSubtitle")}</p>
          {status === "success" ? (
            <p className="form-hint" style={{ color: "var(--color-success)" }}>
              {t("creditSim.leadSuccess")}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
                <label htmlFor="cs-empresa">Empresa</label>
                <input id="cs-empresa" name="empresa" value={lead.empresa} onChange={changeLead} tabIndex={-1} autoComplete="off" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="cs-name">{t("contact.name")}</label>
                  <input id="cs-name" name="name" autoComplete="name" value={lead.name} onChange={changeLead} aria-invalid={Boolean(errors.name)} />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="cs-phone">{t("contact.phone")}</label>
                  <input
                    id="cs-phone"
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
              {status === "rateLimited" && <p className="form-error">{t("contact.rateLimited")}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
                {status === "sending" ? <span className="spinner" /> : null}
                {status === "sending" ? t("contact.sending") : t("creditSim.leadSubmit")}
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
