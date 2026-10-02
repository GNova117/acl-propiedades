import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../lib/format";
import { pricePerM2 } from "../lib/marketStats";
import "./MarketChart.css";

// Gráficas del mercado en internet, dibujadas a mano en SVG (el proyecto no
// tiene librería de gráficas). Colores: slots 1 y 2 de la paleta categórica
// validada (azul = mercado, naranja = tu propiedad), definidos en el CSS.
// Cada anuncio tiene tooltip al pasar el cursor o enfocar con teclado, con un
// área de toque de 14 px de radio; la tabla de anuncios que sigue debajo es la
// vista alternativa con todos los valores.

const W = 680;
const ROW_H = 24;

// Escala "bonita": pasos de 1, 2 o 5 × 10^n.
function niceTicks(rawMax) {
  const max = rawMax > 0 ? rawMax : 1;
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return { ticks, max: ticks[ticks.length - 1] };
}

// $2.4 M / $850 mil, para ejes (las cifras exactas van en el tooltip).
function compactMXN(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)} mil`;
  return `$${Math.round(v)}`;
}

const stateOf = (comp, summary, excludedIds) => {
  if (excludedIds.has(comp.id)) return "excluded";
  if (summary.outlierIds.has(comp.id)) return "outlier";
  return "used";
};

function useTooltip() {
  const [tip, setTip] = useState(null);
  // El contenedor se encuentra desde el propio elemento del evento: así no hace
  // falta guardar una referencia (ref) al DOM.
  const place = (el, clientX, clientY, content) => {
    const rect = el.closest(".market-chart")?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: clientX - rect.left, y: clientY - rect.top, width: rect.width, content });
  };
  return {
    tip,
    onPointer: (content) => (e) => place(e.currentTarget, e.clientX, e.clientY, content),
    // Con teclado no hay puntero: se ancla al centro del elemento enfocado.
    onFocus: (content) => (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      place(e.currentTarget, r.left + r.width / 2, r.top, content);
    },
    hide: () => setTip(null),
  };
}

function Tooltip({ tip }) {
  if (!tip) return null;
  // Si el punto queda en la mitad derecha, el recuadro se abre hacia la izquierda.
  const flip = tip.x > tip.width * 0.55;
  return (
    <div
      className="market-chart__tip"
      role="tooltip"
      style={{ left: tip.x, top: tip.y, transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -110%)` }}
    >
      {tip.content}
    </div>
  );
}

function CompTip({ comp, ppm, state }) {
  const { t } = useTranslation();
  return (
    <>
      <strong>{formatMXN(comp.price)}</strong>
      <span>{comp.colonia || comp.title}</span>
      <span>
        {comp.builtArea ? `${comp.builtArea} m² ${t("valuation.market.tip.built")}` : ""}
        {comp.builtArea && comp.landArea ? " · " : ""}
        {comp.landArea ? `${comp.landArea} m² ${t("valuation.market.tip.land")}` : ""}
      </span>
      <span>
        {formatMXN(ppm)} {t("valuation.perM2")} · {comp.source}
      </span>
      {state !== "used" && <em>{t(`valuation.market.state.${state}`)}</em>}
    </>
  );
}

function Legend({ hasSubject, hasBand }) {
  const { t } = useTranslation();
  return (
    <ul className="market-chart__legend" aria-label={t("valuation.market.chart.legend")}>
      <li>
        <span className="market-chart__key market-chart__key--dot" aria-hidden="true" />
        {t("valuation.market.chart.used")}
      </li>
      <li>
        <span className="market-chart__key market-chart__key--hollow" aria-hidden="true" />
        {t("valuation.market.chart.excluded")}
      </li>
      {hasBand && (
        <li>
          <span className="market-chart__key market-chart__key--band" aria-hidden="true" />
          {t("valuation.market.chart.band")}
        </li>
      )}
      <li>
        <span className="market-chart__key market-chart__key--line" aria-hidden="true" />
        {t("valuation.market.chart.median")}
      </li>
      {hasSubject && (
        <li>
          <span className="market-chart__key market-chart__key--subject" aria-hidden="true" />
          {t("valuation.market.chart.subject")}
        </li>
      )}
    </ul>
  );
}

// Precio del anuncio contra su superficie. La banda azul es el "corredor" del
// mercado: entre el cuartil bajo y el alto del precio por m²; la línea es la
// mediana. Si el punto naranja (tu tabulador) cae dentro, el tabulador va en
// línea con lo que se anuncia.
export function MarketScatter({ comps, summary, basis, excludedIds, subject }) {
  const { t } = useTranslation();
  const tooltip = useTooltip();
  const areaOf = (c) => (basis === "land" ? c.landArea : c.builtArea);
  const points = comps.filter((c) => areaOf(c));
  if (points.length === 0) return null;

  const M = { top: 18, right: 28, bottom: 48, left: 66 };
  const H = 360;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xScale = niceTicks(Math.max(...points.map(areaOf), subject?.area || 0) * 1.06);
  const yScale = niceTicks(Math.max(...points.map((c) => c.price), subject?.high || subject?.value || 0) * 1.06);
  const sx = (v) => M.left + (v / xScale.max) * plotW;
  const sy = (v) => M.top + plotH - (v / yScale.max) * plotH;

  const { p25, median, p75 } = summary.ppm;
  const hasBand = summary.used >= 2 && p75 > 0;

  // Fin de un rayo precio = pendiente × superficie, recortado al cuadro.
  const rayEnd = (slope) => {
    const yAtRight = slope * xScale.max;
    return yAtRight <= yScale.max ? { x: xScale.max, y: yAtRight, top: false } : { x: yScale.max / slope, y: yScale.max, top: true };
  };
  const e25 = rayEnd(p25);
  const e50 = rayEnd(median);
  const e75 = rayEnd(p75);
  const bandPoints = [[0, 0], [e75.x, e75.y]];
  if (e75.top && !e25.top) bandPoints.push([xScale.max, yScale.max]);
  bandPoints.push([e25.x, e25.y]);
  const toPath = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ") + " Z";

  const xTitle = basis === "land" ? t("valuation.market.chart.xLand") : t("valuation.market.chart.xBuilt");

  return (
    <div className="market-chart" onMouseLeave={tooltip.hide}>
      <Legend hasSubject={Boolean(subject)} hasBand={hasBand} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("valuation.market.chart.scatterLabel")}>
        {yScale.ticks.map((v) => (
          <g key={`y${v}`}>
            <line className="market-chart__grid" x1={M.left} x2={W - M.right} y1={sy(v)} y2={sy(v)} />
            <text className="market-chart__tick" x={M.left - 8} y={sy(v)} textAnchor="end" dominantBaseline="middle">
              {compactMXN(v)}
            </text>
          </g>
        ))}
        {xScale.ticks.map((v) => (
          <text key={`x${v}`} className="market-chart__tick" x={sx(v)} y={H - M.bottom + 18} textAnchor="middle">
            {Math.round(v)}
          </text>
        ))}
        <text className="market-chart__axis-title" x={M.left + plotW / 2} y={H - 8} textAnchor="middle">
          {xTitle}
        </text>

        {hasBand && <path className="market-chart__band" d={toPath(bandPoints)} />}
        {hasBand && (
          <>
            <line className="market-chart__median" x1={sx(0)} y1={sy(0)} x2={sx(e50.x)} y2={sy(e50.y)} />
            <text className="market-chart__label" x={sx(e50.x) - 6} y={sy(e50.y) - 8} textAnchor="end">
              {t("valuation.market.chart.medianLabel", { value: formatMXN(median) })}
            </text>
          </>
        )}

        {points.map((comp) => {
          const state = stateOf(comp, summary, excludedIds);
          const ppm = pricePerM2(comp, basis);
          const content = <CompTip comp={comp} ppm={ppm} state={state} />;
          return (
            <g
              key={comp.id}
              className={`market-chart__point market-chart__point--${state}`}
              tabIndex={0}
              role="img"
              aria-label={`${formatMXN(comp.price)}, ${areaOf(comp)} m²`}
              onPointerMove={tooltip.onPointer(content)}
              onFocus={tooltip.onFocus(content)}
              onBlur={tooltip.hide}
            >
              <circle className="market-chart__hit" cx={sx(areaOf(comp))} cy={sy(comp.price)} r="14" />
              <circle className="market-chart__dot" cx={sx(areaOf(comp))} cy={sy(comp.price)} r="5" />
            </g>
          );
        })}

        {subject && (
          <g
            className="market-chart__subject"
            tabIndex={0}
            role="img"
            aria-label={`${t("valuation.market.chart.subject")}: ${formatMXN(subject.value)}`}
            onPointerMove={tooltip.onPointer(
              <>
                <strong>{formatMXN(subject.value)}</strong>
                <span>{t("valuation.market.chart.subject")}</span>
                {subject.low !== subject.high && (
                  <span>
                    {formatMXN(subject.low)} – {formatMXN(subject.high)}
                  </span>
                )}
              </>
            )}
            onBlur={tooltip.hide}
          >
            {subject.low !== subject.high && <line className="market-chart__whisker" x1={sx(subject.area)} x2={sx(subject.area)} y1={sy(subject.low)} y2={sy(subject.high)} />}
            <circle className="market-chart__hit" cx={sx(subject.area)} cy={sy(subject.value)} r="14" />
            <circle className="market-chart__dot market-chart__dot--subject" cx={sx(subject.area)} cy={sy(subject.value)} r="6.5" />
            <text className="market-chart__label" x={sx(subject.area) + 12} y={sy(subject.value) + 4}>
              {t("valuation.market.chart.subject")}
            </text>
          </g>
        )}
      </svg>
      <Tooltip tip={tooltip.tip} />
    </div>
  );
}

// Un renglón por anuncio, ordenados de mayor a menor precio por m². La banda
// azul es el rango habitual (cuartiles) y la línea la mediana: de un vistazo se
// ve qué anuncios están caros o baratos para la zona.
export function MarketDots({ comps, summary, basis, excludedIds, subject }) {
  const { t } = useTranslation();
  const tooltip = useTooltip();
  const rows = comps
    .map((c) => ({ comp: c, ppm: pricePerM2(c, basis) }))
    .filter((r) => r.ppm)
    .sort((a, b) => b.ppm - a.ppm);
  if (rows.length === 0) return null;

  const M = { top: 18, right: 28, bottom: 40, left: 168 };
  const H = M.top + rows.length * ROW_H + M.bottom;
  const plotW = W - M.left - M.right;
  const subjectPpm = subject?.area > 0 ? subject.value / subject.area : 0;

  const xScale = niceTicks(Math.max(...rows.map((r) => r.ppm), subjectPpm) * 1.06);
  const sx = (v) => M.left + (v / xScale.max) * plotW;
  const rowY = (i) => M.top + i * ROW_H + ROW_H / 2;
  const bottom = M.top + rows.length * ROW_H;
  const { p25, median, p75 } = summary.ppm;
  const hasBand = summary.used >= 2 && p75 > 0;
  const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  return (
    <div className="market-chart" onMouseLeave={tooltip.hide}>
      <Legend hasSubject={subjectPpm > 0} hasBand={hasBand} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("valuation.market.chart.dotsLabel")}>
        {xScale.ticks.map((v) => (
          <g key={`x${v}`}>
            <line className="market-chart__grid" x1={sx(v)} x2={sx(v)} y1={M.top} y2={bottom} />
            <text className="market-chart__tick" x={sx(v)} y={bottom + 16} textAnchor="middle">
              {compactMXN(v)}
            </text>
          </g>
        ))}
        <text className="market-chart__axis-title" x={M.left + plotW / 2} y={H - 6} textAnchor="middle">
          {basis === "land" ? t("valuation.market.chart.xPpmLand") : t("valuation.market.chart.xPpmBuilt")}
        </text>

        {hasBand && <rect className="market-chart__band" x={sx(p25)} y={M.top} width={Math.max(sx(p75) - sx(p25), 1)} height={bottom - M.top} />}
        {hasBand && <line className="market-chart__median" x1={sx(median)} x2={sx(median)} y1={M.top} y2={bottom} />}
        {subjectPpm > 0 && (
          <>
            <line className="market-chart__subject-line" x1={sx(subjectPpm)} x2={sx(subjectPpm)} y1={M.top} y2={bottom} />
            <text className="market-chart__label" x={sx(subjectPpm) + 6} y={M.top + 10}>
              {t("valuation.market.chart.subject")}
            </text>
          </>
        )}

        {rows.map(({ comp, ppm }, i) => {
          const state = stateOf(comp, summary, excludedIds);
          const content = <CompTip comp={comp} ppm={ppm} state={state} />;
          return (
            <g
              key={comp.id}
              className={`market-chart__point market-chart__point--${state}`}
              tabIndex={0}
              role="img"
              aria-label={`${comp.colonia || comp.title}: ${formatMXN(ppm)}`}
              onPointerMove={tooltip.onPointer(content)}
              onFocus={tooltip.onFocus(content)}
              onBlur={tooltip.hide}
            >
              <text className="market-chart__row-label" x={M.left - 10} y={rowY(i)} textAnchor="end" dominantBaseline="middle">
                {truncate(comp.colonia || comp.title || comp.source, 24)}
              </text>
              <line className="market-chart__stem" x1={sx(0)} x2={sx(ppm)} y1={rowY(i)} y2={rowY(i)} />
              <circle className="market-chart__hit" cx={sx(ppm)} cy={rowY(i)} r="14" />
              <circle className="market-chart__dot" cx={sx(ppm)} cy={rowY(i)} r="5" />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tooltip.tip} />
    </div>
  );
}
