import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { db } from "../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../lib/format";
import { groupZonesByCity, zoneDisplayName } from "../lib/zones";
import { OFFICE_WHATSAPP } from "../lib/office";
import { sellEstimate } from "../lib/sellEstimate";
import { sellPrefillQuery } from "../lib/sellPrefill";
import "./Calculator.css";

export default function Calculator() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  // 364: la misma fórmula que «Vende tu casa» (terreno y construcción, cada uno con el precio por m² de la zona).
  const [landArea, setLandArea] = useState(200);
  const [builtArea, setBuiltArea] = useState(120);
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

  const isLand = type === "terreno";
  const estimate = useMemo(
    () => sellEstimate({ zone: selectedZone, type, landArea, builtArea }),
    [selectedZone, type, landArea, builtArea]
  );
  // «Pedir estimación formal» lleva lo capturado a «Vende tu casa» para no volver a teclearlo.
  const formalQuery = sellPrefillQuery({ type, zoneId, landArea, builtArea: isLand ? "" : builtArea });

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
              <label htmlFor="calc-land">{t("calculator.landArea")}</label>
              <input id="calc-land" type="number" min="1" step="any" inputMode="decimal" value={landArea} onChange={(e) => setLandArea(e.target.value)} />
            </div>

            {!isLand && (
              <div className="form-field">
                <label htmlFor="calc-built">{t("calculator.builtArea")}</label>
                <input id="calc-built" type="number" min="1" step="any" inputMode="decimal" value={builtArea} onChange={(e) => setBuiltArea(e.target.value)} />
              </div>
            )}

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
                  {Number(selectedZone.land_price_per_m2) > 0 && ` · ${t("calculator.landPricePerM2")}: ${formatMXN(selectedZone.land_price_per_m2)}`}
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

          <div className="calculator-card__result">
            {estimate ? (
              <>
                <span className="calculator-card__label">{t("calculator.result")}</span>
                <span className="calculator-card__value">{formatMXN(estimate.center)}</span>
                <span className="calculator-card__range">
                  {t("calculator.range")}: {formatMXN(estimate.low)} – {formatMXN(estimate.high)}
                </span>
              </>
            ) : (
              <p className="form-hint" role="status">{t("calculator.incomplete")}</p>
            )}
            <p className="calculator-card__disclaimer">{t("calculator.disclaimer")}</p>
            {/* La cifra no termina en la cifra: se puede pedir la estimación formal o hablar con un asesor. */}
            <div className="calculator-card__actions">
              <Link to={`/vende-tu-casa${formalQuery ? `?${formalQuery}` : ""}`} className="btn btn-primary btn-sm">{t("calculator.askFormal")}</Link>
              <a
                className="btn btn-outline btn-sm"
                href={`https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(
                  estimate
                    ? t("calculator.whatsappText", { zone: zoneDisplayName(selectedZone), area: isLand ? landArea : builtArea, type: propertyTypeLabel(t, type), value: formatMXN(estimate.center) })
                    : t("calculator.whatsappTextNoEstimate"),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("calculator.talkToAdvisor")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
