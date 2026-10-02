import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { MUNICIPALITIES } from "../lib/expenseBreakdown";
import { formatMXN } from "../lib/format";
import {
  MIN_COMPS_FOR_ESTIMATE,
  PROPERTY_TYPES,
  ageLabel,
  basisFor,
  deltaVsMarket,
  marketEstimate,
  pricePerM2,
  summarizeMarket,
} from "../lib/marketStats";
import { MarketDots, MarketScatter } from "./MarketChart";
import "./MarketComparables.css";

const MUNICIPALITY_OPTIONS = MUNICIPALITIES.filter((m) => m !== "Otro");
const MAX_NEGOTIATION_PCT = 30;
// Debajo de este porcentaje de diferencia se dice que el tabulador "coincide".
const IN_LINE_PCT = 3;

// Solo se enlazan direcciones http(s): el anuncio viene de internet.
const safeHref = (url) => (/^https?:\/\//i.test(url) ? url : undefined);

// Sección "Mercado en internet" de la valuación (uso interno): busca cuánto se
// anuncian las propiedades de la zona, lo grafica y lo compara con el tabulador.
// `tabulador` trae lo que la valuación por zona ya calculó:
// { center, low, high, landValue } (null si todavía no hay superficie).
export default function MarketComparables({ zoneName, builtArea, landArea, tabulador }) {
  const { t } = useTranslation();
  // Mientras el asesor no escriba su propia colonia, la búsqueda sigue a la zona
  // elegida arriba en la valuación.
  const [typedSearch, setTypedSearch] = useState(null);
  const search = typedSearch ?? zoneName ?? "";
  const [municipality, setMunicipality] = useState("Torreón");
  const [propertyType, setPropertyType] = useState("casa");
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cachedHit, setCachedHit] = useState(false);
  const [excluded, setExcluded] = useState(() => new Set());
  const [dropOutliers, setDropOutliers] = useState(true);
  const [negotiation, setNegotiation] = useState("0");
  const [view, setView] = useState("scatter");

  // Consultas ya guardadas de esta zona: se muestran sin gastar nada.
  useEffect(() => {
    const name = search.trim();
    if (name.length < 2) {
      setHistory([]);
      setSnapshot(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      db.getMarketSnapshots(name)
        .then((rows) => {
          if (cancelled) return;
          const matching = rows.filter((r) => r.municipality === municipality && r.property_type === propertyType);
          setHistory(matching);
          setSnapshot(matching[0] || null);
          setExcluded(new Set());
          setCachedHit(false);
        })
        .catch(() => {
          if (cancelled) return;
          setHistory([]);
          setSnapshot(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, municipality, propertyType]);

  const basis = snapshot?.basis || basisFor(propertyType);
  const comps = useMemo(() => snapshot?.comps || [], [snapshot]);
  const summary = useMemo(() => summarizeMarket(comps, basis, { excludedIds: excluded, dropOutliers }), [comps, basis, excluded, dropOutliers]);
  const estimate = useMemo(
    () => marketEstimate({ summary, builtArea, landArea, negotiationPct: negotiation }),
    [summary, builtArea, landArea, negotiation]
  );

  // Lo que el tabulador de la zona dice del mismo inmueble, en la misma base
  // que los anuncios (un terreno se compara contra el valor del terreno solo).
  const subject = useMemo(() => {
    const area = basis === "land" ? landArea : builtArea;
    if (!(area > 0) || !tabulador) return null;
    if (basis === "land") {
      return tabulador.landValue > 0 ? { area, value: tabulador.landValue, low: tabulador.landValue, high: tabulador.landValue } : null;
    }
    return tabulador.center > 0 ? { area, value: tabulador.center, low: tabulador.low, high: tabulador.high } : null;
  }, [basis, builtArea, landArea, tabulador]);

  const delta = subject && estimate ? deltaVsMarket(subject.value, estimate.center) : null;

  const rows = useMemo(
    () => comps.map((comp) => ({ comp, ppm: pricePerM2(comp, basis) })).sort((a, b) => (b.ppm || 0) - (a.ppm || 0)),
    [comps, basis]
  );

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await db.requestMarketComps({
        zone: search.trim(),
        municipality,
        propertyType,
        builtArea,
        landArea,
        force: Boolean(snapshot),
      });
      if (res.configured === false) {
        setError({ code: "not_configured" });
        return;
      }
      setSnapshot(res.snapshot);
      setExcluded(new Set());
      setCachedHit(Boolean(res.cached));
      setHistory((prev) => [res.snapshot, ...prev.filter((s) => s.id !== res.snapshot.id)]);
    } catch (err) {
      setError({ code: err.code || "upstream", message: err.message, limit: err.limit });
    } finally {
      setLoading(false);
    }
  };

  const toggleExcluded = (id) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDelete = async () => {
    if (!snapshot?.id || !window.confirm(t("valuation.market.confirmDelete"))) return;
    try {
      await db.deleteMarketSnapshot(snapshot.id);
      const rest = history.filter((s) => s.id !== snapshot.id);
      setHistory(rest);
      setSnapshot(rest[0] || null);
      setExcluded(new Set());
    } catch (err) {
      window.alert(err.message || t("valuation.market.deleteError"));
    }
  };

  const errorText = error
    ? error.code === "limit"
      ? t("valuation.market.errors.limit", { limit: error.limit })
      : t(`valuation.market.errors.${error.code}`, { defaultValue: t("valuation.market.errors.upstream"), detail: error.message })
    : "";

  const isDemo = Boolean(snapshot?.usage?.demo);
  const canSearch = search.trim().length >= 2 && !loading;
  const ppmLabel = basis === "land" ? t("valuation.market.kpi.ppmLand") : t("valuation.market.kpi.ppmBuilt");
  const enough = summary.used >= MIN_COMPS_FOR_ESTIMATE;

  const verdict =
    delta === null
      ? null
      : Math.abs(delta) < IN_LINE_PCT
        ? { tone: "ok", text: t("valuation.market.kpi.tabInline") }
        : delta > 0
          ? { tone: "up", text: t("valuation.market.kpi.tabAbove", { pct: Math.round(Math.abs(delta)) }) }
          : { tone: "down", text: t("valuation.market.kpi.tabBelow", { pct: Math.round(Math.abs(delta)) }) };

  const chartProps = { comps, summary, basis, excludedIds: excluded, subject };

  return (
    <section className="card valuation-card market" aria-labelledby="market-title">
      <div>
        <h2 id="market-title" className="valuation-card__title">
          {t("valuation.market.title")}
        </h2>
        <p className="form-hint">{t("valuation.market.subtitle")}</p>
      </div>

      <div className="market__controls">
        <div className="form-field market__zone">
          <label htmlFor="mk-zone">{t("valuation.market.zone")}</label>
          <input
            id="mk-zone"
            type="text"
            maxLength={80}
            value={search}
            placeholder={t("valuation.market.zonePlaceholder")}
            onChange={(e) => setTypedSearch(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="mk-municipality">{t("valuation.market.municipality")}</label>
          <select id="mk-municipality" value={municipality} onChange={(e) => setMunicipality(e.target.value)}>
            {MUNICIPALITY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="mk-type">{t("valuation.market.type")}</label>
          <select id="mk-type" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`valuation.market.types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary market__search" onClick={runSearch} disabled={!canSearch}>
          {loading ? <span className="spinner" /> : null}
          {snapshot ? t("valuation.market.refresh") : t("valuation.market.search")}
        </button>
      </div>

      {loading && (
        <p className="market__notice market__notice--info" role="status">
          {t("valuation.market.searching")}
        </p>
      )}
      {error && (
        <p className="market__notice market__notice--error" role="alert">
          {errorText}
        </p>
      )}

      {!snapshot && !loading && !error && <p className="form-hint">{t("valuation.market.empty")}</p>}

      {snapshot && (
        <>
          <div className="market__meta">
            {isDemo ? (
              <span className="market__chip market__chip--demo">{t("valuation.market.demoBanner")}</span>
            ) : (
              <span className="market__chip">
                {cachedHit
                  ? t("valuation.market.cachedNote", { age: ageLabel(snapshot.created_at) })
                  : t("valuation.market.fresh", { age: ageLabel(snapshot.created_at) })}
              </span>
            )}
            {!isDemo && snapshot.usage?.costUsd > 0 && !cachedHit && (
              <span className="form-hint">{t("valuation.market.cost", { usd: snapshot.usage.costUsd.toFixed(2) })}</span>
            )}
            {history.length > 1 && (
              <label className="market__history">
                <span className="form-hint">{t("valuation.market.pickSnapshot")}</span>
                <select
                  value={snapshot.id || ""}
                  onChange={(e) => {
                    setSnapshot(history.find((s) => s.id === e.target.value) || snapshot);
                    setExcluded(new Set());
                    setCachedHit(false);
                  }}
                >
                  {history.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t("valuation.market.snapshotOption", {
                        date: new Date(s.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
                        count: s.comps?.length || 0,
                      })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {snapshot.id && (
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
                {t("valuation.market.deleteSnapshot")}
              </button>
            )}
          </div>

          {comps.length === 0 ? (
            <p className="market__notice market__notice--info">{t("valuation.market.noComps")}</p>
          ) : (
            <>
              <dl className="market__kpis">
                <div className="market__kpi">
                  <dt>{t("valuation.market.kpi.listings")}</dt>
                  <dd>{t("valuation.market.kpi.listingsOf", { used: summary.used, total: summary.total })}</dd>
                  <span className="form-hint">
                    {summary.outliers > 0 && t("valuation.market.kpi.outliers", { count: summary.outliers })}
                    {summary.outliers > 0 && summary.excluded > 0 ? " · " : ""}
                    {summary.excluded > 0 && t("valuation.market.kpi.excluded", { count: summary.excluded })}
                  </span>
                </div>
                <div className="market__kpi">
                  <dt>{ppmLabel}</dt>
                  <dd>{enough ? formatMXN(summary.ppm.median) : "—"}</dd>
                  <span className="form-hint">
                    {enough ? t("valuation.market.kpi.ppmRange", { low: formatMXN(summary.ppm.p25), high: formatMXN(summary.ppm.p75) }) : t("valuation.market.kpi.tooFew", { n: MIN_COMPS_FOR_ESTIMATE })}
                  </span>
                </div>
                <div className="market__kpi market__kpi--accent">
                  <dt>{t("valuation.market.kpi.estimate")}</dt>
                  <dd>{estimate ? `${formatMXN(estimate.low)} – ${formatMXN(estimate.high)}` : "—"}</dd>
                  <span className="form-hint">
                    {estimate ? `${t("valuation.market.kpi.center")}: ${formatMXN(estimate.center)}` : t("valuation.market.kpi.estimateHint")}
                  </span>
                </div>
                <div className="market__kpi">
                  <dt>{t("valuation.market.kpi.vsTab")}</dt>
                  <dd className={verdict ? `market__verdict market__verdict--${verdict.tone}` : ""}>{verdict ? (verdict.tone === "ok" ? "≈" : `${delta > 0 ? "+" : "−"}${Math.round(Math.abs(delta))}%`) : "—"}</dd>
                  <span className="form-hint">{verdict ? verdict.text : t("valuation.market.kpi.vsTabHint")}</span>
                </div>
              </dl>

              <div className="market__tuning">
                <div className="form-field">
                  <label htmlFor="mk-negotiation">{t("valuation.market.negotiation")}</label>
                  <input
                    id="mk-negotiation"
                    type="number"
                    min="0"
                    max={MAX_NEGOTIATION_PCT}
                    step="1"
                    value={negotiation}
                    onChange={(e) => setNegotiation(e.target.value)}
                  />
                  <span className="form-hint">{t("valuation.market.negotiationHint")}</span>
                </div>
                <label className="market__check">
                  <input type="checkbox" checked={dropOutliers} onChange={(e) => setDropOutliers(e.target.checked)} />
                  {t("valuation.market.dropOutliers")}
                </label>
              </div>

              <div className="market__chart">
                <div className="market__tabs" role="tablist" aria-label={t("valuation.market.chart.title")}>
                  {["scatter", "dots"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={view === key}
                      className={`market__tab${view === key ? " market__tab--active" : ""}`}
                      onClick={() => setView(key)}
                    >
                      {t(`valuation.market.chart.${key}`)}
                    </button>
                  ))}
                </div>
                {view === "scatter" ? <MarketScatter {...chartProps} /> : <MarketDots {...chartProps} />}
              </div>

              <div className="market__table-wrap">
                <table className="admin-table market__table">
                  <caption className="market__caption">{t("valuation.market.table.title")}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("valuation.market.table.use")}</th>
                      <th scope="col">{t("valuation.market.table.listing")}</th>
                      <th scope="col">{t("valuation.market.table.source")}</th>
                      <th scope="col" className="market__num">{t("valuation.market.table.built")}</th>
                      <th scope="col" className="market__num">{t("valuation.market.table.land")}</th>
                      <th scope="col" className="market__num">{t("valuation.market.table.price")}</th>
                      <th scope="col" className="market__num">{t("valuation.perM2")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ comp, ppm }) => {
                      const isExcluded = excluded.has(comp.id);
                      const isOutlier = summary.outlierIds.has(comp.id);
                      return (
                        <tr key={comp.id} className={isExcluded || isOutlier ? "market__row--off" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => toggleExcluded(comp.id)}
                              aria-label={t("valuation.market.table.useAria", { name: comp.colonia || comp.title })}
                            />
                          </td>
                          <td>
                            <div className="market__listing">
                              {safeHref(comp.url) ? (
                                <a href={safeHref(comp.url)} target="_blank" rel="noopener noreferrer">
                                  {comp.title || comp.colonia || comp.source}
                                </a>
                              ) : (
                                <span>{comp.title || comp.colonia}</span>
                              )}
                              <span className="form-hint">{comp.colonia}</span>
                              <span className="market__badges">
                                {isOutlier && !isExcluded && <span className="market__badge market__badge--warn">{t("valuation.market.state.outlier")}</span>}
                                {!comp.exactZone && <span className="market__badge">{t("valuation.market.state.neighbor")}</span>}
                                {comp.verified === false && <span className="market__badge market__badge--warn">{t("valuation.market.state.unverified")}</span>}
                              </span>
                            </div>
                          </td>
                          <td>{comp.source}</td>
                          <td className="market__num">{comp.builtArea ?? "—"}</td>
                          <td className="market__num">{comp.landArea ?? "—"}</td>
                          <td className="market__num">{formatMXN(comp.price)}</td>
                          <td className="market__num">{ppm ? formatMXN(ppm) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {snapshot.notes && !isDemo && <p className="form-hint">{snapshot.notes}</p>}
            </>
          )}
        </>
      )}

      <p className="valuation-result__disclaimer">{t("valuation.market.disclaimer")}</p>
    </section>
  );
}
