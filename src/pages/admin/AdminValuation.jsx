import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ValuationMap from "../../components/ValuationMap";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/dataStore";
import { formatArea, formatMXN } from "../../lib/format";
import { polygonAreaM2 } from "../../lib/geoArea";
import { MAX_SPREAD_PCT, estimateValue } from "../../lib/valuation";
import { downloadValuationPdf } from "../../lib/valuationPdf";
import "./AdminValuation.css";
import "./admin.css";

const DEFAULT_SPREAD_PCT = 10;
const MAX_LEVELS = 10;
const round1 = (n) => Math.round(n * 10) / 10;

// Suma por tipo lo medido en el mapa. La construcción cuenta cada figura por
// sus niveles (planta baja + planta alta = 2 × la huella).
function measuredTotals(shapes) {
  const totals = { land: 0, built: 0 };
  for (const shape of shapes) {
    const area = polygonAreaM2(shape.points);
    totals[shape.kind] += shape.kind === "built" ? area * shape.levels : area;
  }
  return { land: round1(totals.land), built: round1(totals.built) };
}

// Huella digital de las figuras de un tipo, para saber si ese tipo cambió.
const shapesSignature = (shapes, kind) =>
  JSON.stringify(shapes.filter((s) => s.kind === kind).map((s) => [s.id, s.points, s.levels]));

export default function AdminValuation() {
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [shapes, setShapes] = useState([]);
  // Las superficies siempre son editables a mano; el mapa las rellena cuando se
  // dibuja. `fromMap` recuerda cuáles vienen del mapa para mostrar la etiqueta.
  const [areas, setAreas] = useState({ land: "", built: "" });
  const [fromMap, setFromMap] = useState({ land: false, built: false });
  const [spreadPct, setSpreadPct] = useState(String(DEFAULT_SPREAD_PCT));
  const [downloading, setDownloading] = useState(false);
  const [reference, setReference] = useState("");
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    db.getZones().then((data) => {
      setZones(data);
      if (data.length > 0) setZoneId(data[0].id);
    });
  }, []);

  useEffect(() => {
    db.getValuationEstimates().then(setHistory).catch(() => setHistory([]));
  }, []);

  const zone = zones.find((z) => z.id === zoneId);
  const landRate = Number(zone?.land_price_per_m2) || 0;
  const builtRate = Number(zone?.price_per_m2) || 0;

  // Solo se recalcula el tipo (terreno/construcción) cuyas figuras cambiaron:
  // si el asesor corrigió a mano el terreno (p. ej. con la escritura) y luego
  // dibuja la casa, el terreno no debe volver solo a la medida del mapa.
  const applyShapes = (nextShapes) => {
    const totals = measuredTotals(nextShapes);
    const nextAreas = {};
    const nextFromMap = {};
    for (const kind of ["land", "built"]) {
      const changed = shapesSignature(nextShapes, kind) !== shapesSignature(shapes, kind);
      const hasShapes = nextShapes.some((s) => s.kind === kind);
      if (!changed) continue;
      nextAreas[kind] = hasShapes ? String(totals[kind]) : fromMap[kind] ? "" : areas[kind];
      nextFromMap[kind] = hasShapes;
    }
    setShapes(nextShapes);
    setAreas((prev) => ({ ...prev, ...nextAreas }));
    setFromMap((prev) => ({ ...prev, ...nextFromMap }));
  };

  const setLevels = (shapeId, value) => {
    const levels = Math.min(MAX_LEVELS, Math.max(1, Math.floor(Number(value)) || 1));
    applyShapes(shapes.map((s) => (s.id === shapeId ? { ...s, levels } : s)));
  };

  const handleAreaChange = (kind) => (e) => {
    setAreas((prev) => ({ ...prev, [kind]: e.target.value }));
    setFromMap((prev) => ({ ...prev, [kind]: false }));
  };

  useEffect(() => {
    setSavedId(null);
  }, [areas, zoneId, spreadPct, shapes, reference]);

  const result = useMemo(
    () => estimateValue({ landArea: areas.land, builtArea: areas.built, landRate, builtRate, spreadPct }),
    [areas, landRate, builtRate, spreadPct]
  );

  const landArea = Number(areas.land) || 0;
  const builtArea = Number(areas.built) || 0;
  const hasArea = landArea > 0 || builtArea > 0;
  const missing = [
    landArea > 0 && landRate === 0 ? t("valuation.landRate").toLowerCase() : null,
    builtArea > 0 && builtRate === 0 ? t("valuation.builtRate").toLowerCase() : null,
  ].filter(Boolean);

  const pdfLabels = () =>
    Object.fromEntries(
      ["title", "date", "zone", "reference", "range", "center", "breakdown", "landRate", "builtRate", "map", "mapAttribution", "disclaimer"].map(
        (k) => [k, t(`valuation.pdf.${k}`)]
      )
    );

  const runPdf = async (data) => {
    setDownloading(true);
    try {
      await downloadValuationPdf(data, pdfLabels());
    } catch (err) {
      window.alert(err.message || t("valuation.pdf.error"));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = () =>
    runPdf({ zoneName: zone?.name, reference: reference.trim(), landArea, builtArea, landRate, builtRate, spreadPct, result, shapes });

  // Una fila del historial guarda todo lo necesario para rehacer el PDF tal
  // cual se calculó, con los precios de ese día.
  const rowToPdfData = (row) => ({
    zoneName: row.zone_name,
    reference: row.reference,
    date: row.created_at,
    landArea: Number(row.land_area),
    builtArea: Number(row.built_area),
    landRate: Number(row.land_rate),
    builtRate: Number(row.built_rate),
    spreadPct: Number(row.spread_pct),
    result: {
      low: Number(row.low),
      high: Number(row.high),
      center: Number(row.center),
      landValue: Number(row.land_value),
      builtValue: Number(row.built_value),
    },
    shapes: row.shapes || [],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const row = await db.addValuationEstimate({
        reference: reference.trim() || null,
        zone_name: zone?.name || null,
        land_area: landArea,
        built_area: builtArea,
        land_rate: landRate,
        built_rate: builtRate,
        spread_pct: Number(spreadPct) || 0,
        land_value: result.landValue,
        built_value: result.builtValue,
        low: result.low,
        high: result.high,
        center: result.center,
        shapes,
      });
      setHistory((prev) => [row, ...prev]);
      setSavedId(row.id);
    } catch (err) {
      window.alert(err.message || t("valuation.history.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(t("valuation.history.confirmDelete"))) return;
    try {
      await db.deleteValuationEstimate(row.id);
      setHistory((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      window.alert(err.message || t("valuation.history.deleteError"));
    }
  };

  const areaField = (kind, id, label) => (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min="0" step="any" value={areas[kind]} onChange={handleAreaChange(kind)} />
      <span className="form-hint">{fromMap[kind] ? t("valuation.fromMap") : t("valuation.manual")}</span>
    </div>
  );

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("valuation.title")}</h1>
          <p className="form-hint">{t("valuation.subtitle")}</p>
        </div>
      </div>

      <div className="valuation-layout">
        <div className="valuation-layout__map">
          <div className="card valuation-card">
            <ValuationMap shapes={shapes} onShapesChange={applyShapes} />
          </div>

          <div className="card valuation-card">
            <h2 className="valuation-card__title">{t("valuation.figuresTitle")}</h2>
            {shapes.length === 0 ? (
              <p className="form-hint">{t("valuation.noFigures")}</p>
            ) : (
              <ul className="valuation-figures">
                {shapes.map((shape) => {
                  const footprint = polygonAreaM2(shape.points);
                  return (
                    <li key={shape.id} className="valuation-figures__item">
                      <span className={`valuation-figures__swatch valuation-figures__swatch--${shape.kind}`} aria-hidden="true" />
                      <span className="valuation-figures__name">
                        {t(shape.kind === "land" ? "valuation.kindLand" : "valuation.kindBuilt")}
                        <strong> {formatArea(Math.round(footprint))}</strong>
                      </span>
                      {shape.kind === "built" && (
                        <label className="valuation-figures__levels" title={t("valuation.levelsHint")}>
                          {t("valuation.levels")}
                          <input
                            type="number"
                            min="1"
                            max={MAX_LEVELS}
                            step="1"
                            value={shape.levels}
                            onChange={(e) => setLevels(shape.id, e.target.value)}
                          />
                        </label>
                      )}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => applyShapes(shapes.filter((s) => s.id !== shape.id))}>
                        {t("valuation.remove")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="valuation-layout__side">
          <div className="card valuation-card">
            {zones.length === 0 ? (
              <p className="form-hint">{t("valuation.noZones")}</p>
            ) : (
              <>
                <div className="form-field">
                  <label htmlFor="val-zone">{t("valuation.zone")}</label>
                  <select id="val-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <dl className="valuation-rates" aria-label={t("valuation.zoneRates")}>
                  <div>
                    <dt>{t("valuation.landRate")}</dt>
                    <dd>
                      {formatMXN(landRate)} {t("valuation.perM2")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("valuation.builtRate")}</dt>
                    <dd>
                      {formatMXN(builtRate)} {t("valuation.perM2")}
                    </dd>
                  </div>
                </dl>
              </>
            )}

            <div className="form-row">
              {areaField("land", "val-land", t("valuation.landArea"))}
              {areaField("built", "val-built", t("valuation.builtArea"))}
            </div>

            <div className="form-field">
              <label htmlFor="val-reference">{t("valuation.history.reference")}</label>
              <input
                id="val-reference"
                type="text"
                maxLength={120}
                value={reference}
                placeholder={t("valuation.history.referencePlaceholder")}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="val-spread">{t("valuation.spread")}</label>
              <input
                id="val-spread"
                type="number"
                min="0"
                max={MAX_SPREAD_PCT}
                step="1"
                value={spreadPct}
                onChange={(e) => setSpreadPct(e.target.value)}
              />
            </div>
          </div>

          <div className="card valuation-result" aria-live="polite">
            <span className="valuation-result__label">{t("valuation.resultTitle")}</span>
            {hasArea && zone ? (
              <>
                <span className="valuation-result__range-label">{t("valuation.range")}</span>
                <span className="valuation-result__value">
                  {formatMXN(result.low)} – {formatMXN(result.high)}
                </span>
                <span className="valuation-result__center">
                  {t("valuation.center")}: <strong>{formatMXN(result.center)}</strong>
                </span>

                <dl className="valuation-result__breakdown" aria-label={t("valuation.breakdown")}>
                  {landArea > 0 && (
                    <div>
                      <dt>
                        {t("valuation.landRate")} · {formatArea(landArea)} × {formatMXN(landRate)}
                      </dt>
                      <dd>{formatMXN(result.landValue)}</dd>
                    </div>
                  )}
                  {builtArea > 0 && (
                    <div>
                      <dt>
                        {t("valuation.builtRate")} · {formatArea(builtArea)} × {formatMXN(builtRate)}
                      </dt>
                      <dd>{formatMXN(result.builtValue)}</dd>
                    </div>
                  )}
                </dl>

                {missing.length > 0 && (
                  <p className="valuation-result__warning" role="alert">
                    {t("valuation.missingRate", { what: missing.join(` ${t("valuation.and")} `) })}{" "}
                    {hasSection("zonas") && <Link to="/admin/zonas">{t("valuation.editRates")}</Link>}
                  </p>
                )}
              </>
            ) : (
              <p className="form-hint">{t("valuation.emptyResult")}</p>
            )}
            {hasArea && zone && (
              <div className="valuation-result__actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || Boolean(savedId)}>
                  {saving ? <span className="spinner" /> : null}
                  {savedId ? t("valuation.history.saved") : t("valuation.history.save")}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleDownload} disabled={downloading}>
                  {downloading ? <span className="spinner" /> : null}
                  {t("valuation.pdf.download")}
                </button>
              </div>
            )}
            <p className="valuation-result__disclaimer">{t("valuation.disclaimer")}</p>
          </div>
        </div>
      </div>

      <div className="card valuation-card valuation-history">
        <h2 className="valuation-card__title">{t("valuation.history.title")}</h2>
        {history.length === 0 ? (
          <p className="form-hint">{t("valuation.history.empty")}</p>
        ) : (
          <ul className="valuation-history__list">
            {history.map((row) => (
              <li key={row.id} className="valuation-history__item">
                <div className="valuation-history__info">
                  <strong>{row.reference || t("valuation.history.noReference")}</strong>
                  <span className="form-hint">
                    {new Date(row.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                    {row.zone_name ? ` · ${row.zone_name}` : ""}
                    {row.created_by ? ` · ${row.created_by}` : ""}
                  </span>
                </div>
                <span className="valuation-history__range">
                  {formatMXN(row.low)} – {formatMXN(row.high)}
                </span>
                <div className="valuation-history__actions">
                  <button type="button" className="btn btn-outline btn-sm" disabled={downloading} onClick={() => runPdf(rowToPdfData(row))}>
                    {t("valuation.pdf.download")}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(row)}>
                    {t("valuation.remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
