import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { db } from "../lib/dataStore";
import { formatMXN } from "../lib/format";
import { COMPARE_DEFAULTS, compareCredits } from "../lib/creditCompare";
import { isValidPhone, sendLead } from "../lib/lead";
import "./PublicForms.css";
import "./CreditCompare.css";

// Comparador de opciones de compra (Infonavit, banco y contado) para una casa
// concreta. Se llega desde la ficha de una propiedad (?propiedad=<id>, que trae
// el precio) o directo. Al final invita a dejar nombre y teléfono; llega a
// Mensajes (canal "comparador") con el resumen.
export default function CreditCompare() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get("propiedad");
  const [property, setProperty] = useState(null);
  const [form, setForm] = useState({ price: 1500000, salary: 20000, age: 35, sex: "hombre", ssv: 0, ...COMPARE_DEFAULTS });
  const [lead, setLead] = useState({ name: "", phone: "", empresa: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!propertyId) return;
    db.getPropertyById(propertyId)
      .then((p) => {
        if (!p) return;
        setProperty(p);
        setForm((prev) => ({ ...prev, price: Number(p.price) || prev.price }));
      })
      .catch(() => {});
  }, [propertyId]);

  const result = useMemo(() => compareCredits(form), [form]);
  const change = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const changeLead = (e) => setLead((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const by = Object.fromEntries(result.options.map((o) => [o.key, o]));
  const years = (n) => t("creditCompare.years", { count: n });

  const rows = (o) => {
    if (o.key === "contado") {
      return [
        [t("creditCompare.upfront"), formatMXN(o.cashNow), "upfront"],
        [t("creditCompare.payment"), t("creditCompare.noPayment")],
        [t("creditCompare.totalCost"), formatMXN(o.totalCost), "totalCost"],
      ];
    }
    const list = [
      [t("creditCompare.upfront"), formatMXN(o.cashNow), "upfront"],
    ];
    if (o.ssvUsed > 0) list.push([t("creditCompare.ssvUsed"), formatMXN(o.ssvUsed)]);
    list.push(
      [t("creditCompare.financed"), formatMXN(o.financed)],
      [t("creditCompare.payment"), `${formatMXN(o.payment)} ${t("creditCompare.perMonth")}`, "payment"],
      [t("creditCompare.term"), years(o.key === "banco" ? Number(form.bankYears) : o.years)],
      [t("creditCompare.interest"), formatMXN(o.interest)],
      [t("creditCompare.minIncome"), formatMXN(o.minIncome)],
      [t("creditCompare.totalCost"), formatMXN(o.totalCost), "totalCost"]
    );
    return list;
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
    const message = [
      "Comparador de créditos — pide asesoría.",
      property ? `Propiedad: ${property.title}${property.code ? ` (${property.code})` : ""} — ${formatMXN(result.price)}.` : `Precio de referencia: ${formatMXN(result.price)}.`,
      `Contado: ${formatMXN(by.contado.cashNow)} al inicio.`,
      `Banco (${form.bankRate} %, ${form.bankYears} años, enganche ${form.bankDownPct} %): ${formatMXN(by.banco.cashNow)} al inicio, cuota ${formatMXN(by.banco.payment)}.`,
      by.infonavit.available
        ? `Infonavit (salario ${formatMXN(form.salary)}, edad ${form.age}): ${formatMXN(by.infonavit.cashNow)} al inicio, cuota ${formatMXN(by.infonavit.payment)}.`
        : "Infonavit: sin datos suficientes para calcular.",
    ].join("\n");
    const outcome = await sendLead({
      rateKey: "acl_comparador_last_submit",
      honeypot: lead.empresa,
      name: lead.name,
      phone: lead.phone,
      message,
      channel: "comparador",
      details: { price: result.price, salary: Number(form.salary), age: Number(form.age), property_id: property?.id || null },
    });
    setStatus(outcome);
    if (outcome === "success") setLead({ name: "", phone: "", empresa: "" });
  };

  const badge = (o, key) => {
    const flags = [];
    if (result.best.totalCost === o.key) flags.push("totalCost");
    if (result.best.payment === o.key) flags.push("payment");
    if (result.best.upfront === o.key) flags.push("upfront");
    return key && flags.includes(key);
  };

  return (
    <>
      <Seo title={t("creditCompare.seoTitle")} description={t("creditCompare.subtitle")} />
      <div className="container public-form-page credit-compare">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h1 style={{ fontSize: "2rem" }}>{t("creditCompare.title")}</h1>
          <p>{t("creditCompare.subtitle")}</p>
        </div>

        <div className="card public-form-card">
          {property && (
            <p className="credit-compare__property">
              {t("creditCompare.forProperty")}{" "}
              <Link to={`/propiedades/${property.id}`}>
                <strong>{property.title}</strong>
              </Link>
            </p>
          )}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="cc-price">{t("creditCompare.price")}</label>
              <input id="cc-price" type="number" min="0" inputMode="numeric" value={form.price} onChange={change("price")} />
            </div>
            <div className="form-field">
              <label htmlFor="cc-salary">{t("infonavit.monthlySalary")}</label>
              <input id="cc-salary" type="number" min="0" inputMode="numeric" value={form.salary} onChange={change("salary")} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="cc-age">{t("infonavit.age")}</label>
              <input id="cc-age" type="number" min="18" max="99" inputMode="numeric" value={form.age} onChange={change("age")} />
            </div>
            <div className="form-field">
              <label htmlFor="cc-sex">{t("infonavit.sex")}</label>
              <select id="cc-sex" value={form.sex} onChange={change("sex")}>
                <option value="hombre">{t("infonavit.sexMale")}</option>
                <option value="mujer">{t("infonavit.sexFemale")}</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="cc-ssv">{t("creditSim.ssvShort")}</label>
              <input id="cc-ssv" type="number" min="0" inputMode="numeric" value={form.ssv} onChange={change("ssv")} />
            </div>
          </div>

          <details className="credit-compare__advanced">
            <summary>{t("creditCompare.advanced")}</summary>
            <p className="form-hint">{t("creditCompare.advancedHint")}</p>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="cc-rate">{t("creditCompare.bankRate")}</label>
                <input id="cc-rate" type="number" min="0" step="0.1" value={form.bankRate} onChange={change("bankRate")} />
              </div>
              <div className="form-field">
                <label htmlFor="cc-down">{t("creditCompare.bankDown")}</label>
                <input id="cc-down" type="number" min="0" max="100" value={form.bankDownPct} onChange={change("bankDownPct")} />
              </div>
              <div className="form-field">
                <label htmlFor="cc-years">{t("creditCompare.bankYears")}</label>
                <input id="cc-years" type="number" min="1" max="30" value={form.bankYears} onChange={change("bankYears")} />
              </div>
              <div className="form-field">
                <label htmlFor="cc-closing">{t("creditCompare.closing")}</label>
                <input id="cc-closing" type="number" min="0" max="15" step="0.5" value={form.closingCostsPct} onChange={change("closingCostsPct")} />
              </div>
            </div>
          </details>
        </div>

        <div className="credit-compare__grid">
          {["infonavit", "banco", "contado"].map((key) => {
            const o = by[key];
            const unavailable = key === "infonavit" && !o.available;
            return (
              <article key={key} className={`card credit-option credit-option--${key}${unavailable ? " is-disabled" : ""}`}>
                <h2>{t(`creditCompare.options.${key}`)}</h2>
                <p className="form-hint" style={{ marginTop: 0 }}>
                  {t(`creditCompare.optionsHint.${key}`)}
                </p>
                {unavailable ? (
                  <p className="form-hint">{t("creditCompare.infonavitUnavailable")}</p>
                ) : (
                  <>
                    {key === "infonavit" && o.coversAll && <p className="credit-compare__note">{t("creditCompare.coversAll")}</p>}
                    {key === "infonavit" && !o.coversAll && <p className="credit-compare__note credit-compare__note--warn">{t("creditCompare.needsDown", { amount: formatMXN(o.cashNow - result.closingCosts) })}</p>}
                    <dl className="credit-option__rows">
                      {rows(o).map(([label, value, flag]) => (
                        <div key={label} className={flag && badge(o, flag) ? "is-best" : ""}>
                          <dt>{label}</dt>
                          <dd>
                            {value}
                            {flag && badge(o, flag) && <span className="credit-option__badge">{t(`creditCompare.best.${flag}`)}</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </article>
            );
          })}
        </div>

        <p className="form-hint">{t("creditCompare.disclaimer", { closing: form.closingCostsPct })}</p>

        <div className="card public-form-card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("creditCompare.leadTitle")}</h2>
          <p className="form-hint">{t("creditCompare.leadSubtitle")}</p>
          {status === "success" ? (
            <p className="form-hint" style={{ color: "var(--color-success)" }}>
              {t("creditSim.leadSuccess")}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
                <label htmlFor="cc-empresa">Empresa</label>
                <input id="cc-empresa" name="empresa" value={lead.empresa} onChange={changeLead} tabIndex={-1} autoComplete="off" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="cc-name">{t("contact.name")}</label>
                  <input id="cc-name" name="name" autoComplete="name" value={lead.name} onChange={changeLead} aria-invalid={Boolean(errors.name)} />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="cc-phone">{t("contact.phone")}</label>
                  <input
                    id="cc-phone"
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
