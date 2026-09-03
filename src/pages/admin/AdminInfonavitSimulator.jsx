import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../../lib/format";
import { UMA_2026, simularCreditoInfonavit } from "../../lib/infonavitSimulator";
import "./AdminInfonavitSimulator.css";
import "./admin.css";

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
      </div>
    </div>
  );
}
