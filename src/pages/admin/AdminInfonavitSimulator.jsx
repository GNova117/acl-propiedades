import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../../lib/format";
import { UMA_2026, simularCreditoInfonavit } from "../../lib/infonavitSimulator";
import "./AdminInfonavitSimulator.css";
import "./admin.css";

const FUENTES = [
  { label: "INEGI — Valor de la UMA 2026 (comunicado)", url: "https://x.com/INEGI_INFORMA/status/2009235303110987852" },
  { label: "Infonavit — Portal oficial (tabla de tasas diferenciadas)", url: "https://portalmx.infonavit.org.mx" },
  { label: "El Siglo de Torreón — Tasa de interés del crédito Infonavit", url: "https://www.elsiglodetorreon.com.mx/noticia/2026/cual-es-la-tasa-de-interes-de-un-credito-infonavit.html" },
  { label: "Infobae — Créditos Infonavit 2026 según edad y sueldo", url: "https://www.infobae.com/mexico/2026/06/19/creditos-infonavit-2026-asi-quedaria-tu-pago-mensual-segun-tu-edad-y-sueldo-actual/" },
];

const EMPTY = { edad: 30, sexo: "hombre", salarioMensual: 12000, ssv: 30000 };

export default function AdminInfonavitSimulator() {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const result = useMemo(() => simularCreditoInfonavit(form), [form]);

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("infonavit.title")}</h1>
          <p className="form-hint">{t("infonavit.subtitle")}</p>
        </div>
      </div>

      <div className="infonavit-layout">
        <div className="card infonavit-form">
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="inf-edad">{t("infonavit.age")}</label>
              <input id="inf-edad" type="number" min="18" max="99" value={form.edad} onChange={handleChange("edad")} />
            </div>
            <div className="form-field">
              <label htmlFor="inf-sexo">{t("infonavit.sex")}</label>
              <select id="inf-sexo" value={form.sexo} onChange={handleChange("sexo")}>
                <option value="hombre">{t("infonavit.sexMale")}</option>
                <option value="mujer">{t("infonavit.sexFemale")}</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="inf-salario">{t("infonavit.monthlySalary")}</label>
            <input id="inf-salario" type="number" min="0" value={form.salarioMensual} onChange={handleChange("salarioMensual")} />
          </div>

          <div className="form-field">
            <label htmlFor="inf-ssv">{t("infonavit.ssv")}</label>
            <input id="inf-ssv" type="number" min="0" value={form.ssv} onChange={handleChange("ssv")} />
          </div>

          <div className="infonavit-params">
            <h3>{t("infonavit.parametersTitle")}</h3>
            <dl>
              <div>
                <dt>{t("infonavit.umaMonthly")}</dt>
                <dd>{formatMXN(UMA_2026.mensual)}</dd>
              </div>
              <div>
                <dt>{t("infonavit.salaryInUma")}</dt>
                <dd>{result.salarioEnUma.toFixed(2)} UMA</dd>
              </div>
              <div>
                <dt>{t("infonavit.assignedRate")}</dt>
                <dd>{result.tasaAnual.toFixed(2)}%</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="infonavit-results">
          <div className="card infonavit-hero">
            <span className="infonavit-hero__label">{t("infonavit.totalCapacity")}</span>
            <span className="infonavit-hero__value">{formatMXN(result.capacidadTotal)}</span>
            <div className="infonavit-hero__breakdown">
              <span>{t("infonavit.creditAmount")}: <strong>{formatMXN(result.montoCredito)}</strong></span>
              <span>{t("infonavit.ssvBalance")}: <strong>{formatMXN(result.saldoSsv)}</strong></span>
            </div>
            <div className="infonavit-hero__payment">
              {t("infonavit.monthlyPayment")}: <strong>{formatMXN(result.pagoMensual)}</strong>
            </div>
          </div>

          {result.plazoAnios === 0 && <p className="infonavit-warning">{t("infonavit.ageLimitWarning")}</p>}

          <div className="card">
            <h3 className="profiling-section-title">{t("infonavit.breakdownTitle")}</h3>
            <table className="infonavit-breakdown-table">
              <tbody>
                <tr>
                  <td>{t("infonavit.titlingExpenses")}</td>
                  <td>{result.exentoTitulacion ? t("infonavit.titlingExempt") : t("infonavit.titlingApplies")}</td>
                </tr>
                <tr>
                  <td>{t("infonavit.financialFees")}</td>
                  <td>{formatMXN(0)} — {t("infonavit.financialFeesNote")}</td>
                </tr>
                <tr>
                  <td>{t("infonavit.appraisalReference")}</td>
                  <td>
                    {formatMXN(result.capacidadTotal)}
                    <span className="form-hint infonavit-inline-hint"> ({t("infonavit.appraisalHint")})</span>
                  </td>
                </tr>
                <tr>
                  <td>{t("infonavit.termYears")}</td>
                  <td>{result.plazoAnios} {t("infonavit.years")}</td>
                </tr>
              </tbody>
            </table>
            <p className="form-hint">{t("infonavit.complementaryNote")}</p>
          </div>
        </div>
      </div>

      <div className="card infonavit-disclaimer">
        <h3>{t("infonavit.disclaimerTitle")}</h3>
        <p>{t("infonavit.disclaimerBody")}</p>
        <p>{t("infonavit.disclaimerRates")}</p>
        <p className="infonavit-sources__title">{t("infonavit.sourcesTitle")}:</p>
        <ul className="infonavit-sources">
          {FUENTES.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noreferrer">{f.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
