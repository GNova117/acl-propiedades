import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { COMPARE_DEFAULTS } from "../lib/creditCompare";
import { CALCULATOR_ANCHOR, mortgageBreakdown } from "../lib/monthlyEstimate";
import { formatMXN } from "../lib/format";
import "./MortgageCalculator.css";

const LIMITS = {
  down: { min: 10, max: 60, step: 5 },
  years: { min: 5, max: 30, step: 1 },
  rate: { min: 7, max: 16, step: 0.25 },
};

// Calculadora de mensualidad de la ficha: la persona mueve enganche, plazo y
// tasa y ve cómo cambia la cuota. Arranca con los mismos valores de referencia
// que la cifra «≈ $X al mes» de la tarjeta y del comparador de créditos.
// Es una referencia, no una oferta ni una aprobación de crédito.
export default function MortgageCalculator({ property }) {
  const { t } = useTranslation();
  const uid = useId();
  const [down, setDown] = useState(COMPARE_DEFAULTS.bankDownPct);
  const [years, setYears] = useState(COMPARE_DEFAULTS.bankYears);
  const [rate, setRate] = useState(COMPARE_DEFAULTS.bankRate);

  const result = mortgageBreakdown(property.price, down, years, rate);
  if (!result) return null;

  const isDefault = down === COMPARE_DEFAULTS.bankDownPct && years === COMPARE_DEFAULTS.bankYears && rate === COMPARE_DEFAULTS.bankRate;
  const reset = () => {
    setDown(COMPARE_DEFAULTS.bankDownPct);
    setYears(COMPARE_DEFAULTS.bankYears);
    setRate(COMPARE_DEFAULTS.bankRate);
  };

  const sliders = [
    { key: "down", label: t("mortgageCalc.down"), value: down, set: setDown, display: `${down}% · ${formatMXN(result.down)}`, ...LIMITS.down },
    { key: "years", label: t("mortgageCalc.years"), value: years, set: setYears, display: t("mortgageCalc.yearsValue", { count: years }), ...LIMITS.years },
    { key: "rate", label: t("mortgageCalc.rate"), value: rate, set: setRate, display: `${rate}%`, ...LIMITS.rate },
  ];

  return (
    <section className="card mortgage-calc" id={CALCULATOR_ANCHOR} aria-labelledby={`${uid}-title`}>
      <div className="mortgage-calc__head">
        <h2 id={`${uid}-title`}>{t("mortgageCalc.title")}</h2>
        {!isDefault && (
          <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
            {t("mortgageCalc.reset")}
          </button>
        )}
      </div>

      <div className="mortgage-calc__body">
        <div className="mortgage-calc__controls">
          {sliders.map((slider) => (
            <div className="mortgage-calc__control" key={slider.key}>
              <label htmlFor={`${uid}-${slider.key}`}>
                <span>{slider.label}</span>
                <strong>{slider.display}</strong>
              </label>
              <input
                id={`${uid}-${slider.key}`}
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={slider.value}
                onChange={(e) => slider.set(Number(e.target.value))}
                aria-valuetext={slider.display}
              />
            </div>
          ))}
        </div>

        <div className="mortgage-calc__result" aria-live="polite">
          <span className="mortgage-calc__result-label">{t("mortgageCalc.monthly")}</span>
          <strong className="mortgage-calc__payment">{formatMXN(Math.round(result.payment))}</strong>
          <dl>
            <div><dt>{t("mortgageCalc.loan")}</dt><dd>{formatMXN(Math.round(result.loan))}</dd></div>
            <div><dt>{t("mortgageCalc.interest")}</dt><dd>{formatMXN(Math.round(result.interest))}</dd></div>
            <div><dt>{t("mortgageCalc.totalPaid")}</dt><dd>{formatMXN(Math.round(result.totalPaid))}</dd></div>
          </dl>
        </div>
      </div>

      <p className="form-hint mortgage-calc__note">{t("mortgageCalc.note")}</p>
      <Link to={`/comparar-creditos?propiedad=${property.id}`} className="btn btn-outline btn-sm">
        {t("monthlyEstimate.cta")}
      </Link>
    </section>
  );
}
