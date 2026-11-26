import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { db, TYPE_FACTORS } from "../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../lib/format";
import { groupZonesByCity, zoneDisplayName } from "../lib/zones";
import { OFFICE_WHATSAPP } from "../lib/office";
import "./Calculator.css";

export default function Calculator() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [area, setArea] = useState(120);
  const [zoneId, setZoneId] = useState("");
  const [type, setType] = useState("casa");

  useEffect(() => {
    db.getZones()
      .then((data) => {
        setZones(data);
        if (data.length > 0) setZoneId(data[0].id);
      })
      .catch(() => {});
    db.getPropertyTypes().then(setPropertyTypes).catch(() => {});
  }, []);

  const selectedZone = zones.find((z) => z.id === zoneId);

  const estimate = useMemo(() => {
    if (!selectedZone) return null;
    // Un terreno usa el precio por m² de terreno de la zona (ya lo trae cada zona); lo demás, el de construcción con su factor por tipo.
    const landRate = Number(selectedZone.land_price_per_m2);
    const base = type === "terreno" && landRate > 0 ? Number(area) * landRate : Number(area) * Number(selectedZone.price_per_m2) * (TYPE_FACTORS[type] || 1);
    return { base, low: base * 0.9, high: base * 1.1 };
  }, [area, selectedZone, type]);

  return (
    <>
      <Seo title={t("nav.calculator")} description={t("calculator.subtitle")} />

      <div className="container calculator-page">
        <div className="section-heading m-section">
          <h1>{t("calculator.title")}</h1>
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
                {groupZonesByCity(zones).map(({ city, zones: groupZones }) => (
                  <optgroup key={city ?? "other"} label={city ?? t("zones.otherZones")}>
                    {groupZones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zoneDisplayName(zone)}
                      </option>
                    ))}
                  </optgroup>
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
              {/* La cifra no termina en la cifra: se puede pedir la estimación formal o hablar con un asesor. */}
              <div className="calculator-card__actions">
                <Link to="/vende-tu-casa" className="btn btn-primary btn-sm">{t("calculator.askFormal")}</Link>
                <a
                  className="btn btn-outline btn-sm"
                  href={`https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(t("calculator.whatsappText", { zone: zoneDisplayName(selectedZone), area, type: propertyTypeLabel(t, type), value: formatMXN(estimate.base) }))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("calculator.talkToAdvisor")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
