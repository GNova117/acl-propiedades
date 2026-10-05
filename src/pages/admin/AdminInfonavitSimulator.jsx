import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../../lib/format";
import { UMA_2026, simularCreditoInfonavit, calcularSubcuentaViviendaPorEmpleos } from "../../lib/infonavitSimulator";
import "./AdminInfonavitSimulator.css";
import "./admin.css";

const EMPTY = { edad: 30, sexo: "hombre", salarioMensual: 12000, ssv: 30000 };
const EMPTY_EMPLEO = { salarioDiario: "", aniosTrabajados: "" };

export default function AdminInfonavitSimulator() {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [empleos, setEmpleos] = useState([EMPTY_EMPLEO]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const result = useMemo(() => simularCreditoInfonavit(form), [form]);
  const subcuenta = useMemo(() => calcularSubcuentaViviendaPorEmpleos(empleos), [empleos]);

  const changeEmpleo = (index, field) => (e) => {
    const value = e.target.value;
    setEmpleos((prev) => prev.map((empleo, i) => (i === index ? { ...empleo, [field]: value } : empleo)));
  };
  const addEmpleo = () => setEmpleos((prev) => [...prev, EMPTY_EMPLEO]);
  const removeEmpleo = (index) => setEmpleos((prev) => prev.filter((_, i) => i !== index));
  const usarSubcuentaEstimada = () => setForm((prev) => ({ ...prev, ssv: Math.round(subcuenta.total) }));

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

        <div className="card infonavit-form">
          <h3>{t("creditSim.ssvCalc.title")}</h3>
          <p className="form-hint" style={{ marginTop: "-0.5rem" }}>{t("creditSim.ssvCalc.subtitle")}</p>

          <div className="ssv-calc-table">
            <div className="ssv-calc-table__row ssv-calc-table__row--head">
              <span>{t("creditSim.ssvCalc.dailySalary")}</span>
              <span>{t("creditSim.ssvCalc.yearsWorked")}</span>
              <span>{t("creditSim.ssvCalc.subtotal")}</span>
              <span />
            </div>
            {empleos.map((empleo, index) => {
              const fila = subcuenta.detalle[index];
              return (
                <div className="ssv-calc-table__row" key={index}>
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    aria-label={t("creditSim.ssvCalc.dailySalary")}
                    value={empleo.salarioDiario}
                    onChange={changeEmpleo(index, "salarioDiario")}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    aria-label={t("creditSim.ssvCalc.yearsWorked")}
                    value={empleo.aniosTrabajados}
                    onChange={changeEmpleo(index, "aniosTrabajados")}
                  />
                  <span className="ssv-calc-table__subtotal">{formatMXN(fila ? fila.total : 0)}</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => removeEmpleo(index)}
                    disabled={empleos.length === 1}
                    aria-label={t("creditSim.ssvCalc.removeJob")}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <button type="button" className="btn btn-outline btn-sm" onClick={addEmpleo} style={{ marginTop: "0.25rem", alignSelf: "flex-start" }}>
            {t("creditSim.ssvCalc.addJob")}
          </button>

          <div className="infonavit-ssv-total">
            <span>{t("creditSim.ssvCalc.estimatedTotal")}</span>
            <strong>{formatMXN(subcuenta.total)}</strong>
            <button type="button" className="btn btn-primary btn-sm" onClick={usarSubcuentaEstimada}>
              {t("creditSim.ssvCalc.useInSimulator")}
            </button>
          </div>
          <p className="form-hint" style={{ marginBottom: 0 }}>
            {t("creditSim.ssvCalc.disclaimer")}
          </p>
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
