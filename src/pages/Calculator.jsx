import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { db, TYPE_FACTORS } from "../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../lib/format";
import "./Calculator.css";

export default function Calculator() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [area, setArea] = useState(120);
  const [zoneId, setZoneId] = useState("");
  const [type, setType] = useState("casa");

  useEffect(() => {
    db.getZones().then((data) => {
      setZones(data);
      if (data.length > 0) setZoneId(data[0].id);
    });
    db.getPropertyTypes().then(setPropertyTypes);
  }, []);

  const selectedZone = zones.find((z) => z.id === zoneId);

  const estimate = useMemo(() => {
    if (!selectedZone) return null;
    const base = Number(area) * Number(selectedZone.price_per_m2) * (TYPE_FACTORS[type] || 1);
    return { base, low: base * 0.9, high: base * 1.1 };
  }, [area, selectedZone, type]);

  return (
    <>
      <Seo title={t("nav.calculator")} description={t("calculator.subtitle")} />

      <div className="container calculator-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h2>{t("calculator.title")}</h2>
          <p>{t("calculator.subtitle")}</p>
        </div>

        <div className="calculator-card card">
          <div className="calculator-card__form">
            <div className="form-field">
              <label htmlFor="calc-area">{t("calculator.area")}</label>
              <input
                id="calc-area"
                type="range"
                min="30"
                max="5000"
                step="5"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
              <input
                type="number"
                min="1"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                aria-label={t("calculator.area")}
              />
            </div>

            <div className="form-field">
              <label htmlFor="calc-zone">{t("calculator.zone")}</label>
              <select id="calc-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              {selectedZone && (
                <span className="form-hint">
                  {t("calculator.pricePerM2")}: {formatMXN(selectedZone.price_per_m2)}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="calc-type">{t("calculator.type")}</label>
              <select id="calc-type" value={type} onChange={(e) => setType(e.target.value)}>
                {propertyTypes.map((pt) => (
                  <option key={pt.id} value={pt.key}>
                    {propertyTypeLabel(t, pt.key)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {estimate && (
            <div className="calculator-card__result">
              <span className="calculator-card__label">{t("calculator.result")}</span>
              <span className="calculator-card__value">{formatMXN(estimate.base)}</span>
              <span className="calculator-card__range">
                {t("calculator.range")}: {formatMXN(estimate.low)} – {formatMXN(estimate.high)}
              </span>
              <p className="calculator-card__disclaimer">{t("calculator.disclaimer")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
