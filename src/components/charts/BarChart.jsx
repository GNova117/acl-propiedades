import { useTranslation } from "react-i18next";
import { maxValue } from "../../lib/dashboardCharts";
import "./BarChart.css";

// Gráfica de barras sin librerías (divs con ancho/alto en %): horizontal (`orientation="horizontal"`: una fila por dato, con
// su nombre y su número) o vertical (`"vertical"`: columnas, p. ej. por mes). Accesible: la gráfica es `role="img"` con un
// resumen en `ariaLabel` y los mismos datos van en una tabla que se abre con «Ver los datos»; el número va escrito en cada
// barra (el color no es lo único que dice algo).
// `items`: [{ key, value, label }] ya traducidos; `format`: cómo se escribe cada número.
export default function BarChart({ title, items, ariaLabel, orientation = "horizontal", format = (v) => String(v), valueLabel, emptyText }) {
  const { t } = useTranslation();
  const max = maxValue(items);
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const empty = total === 0;

  return (
    <figure className="bar-chart">
      <figcaption className="bar-chart__title">{title}</figcaption>
      {empty ? (
        <p className="form-hint">{emptyText || t("charts.empty")}</p>
      ) : (
        <>
          <div className={`bar-chart__plot bar-chart__plot--${orientation}`} role="img" aria-label={ariaLabel}>
            {items.map((item) => {
              const pct = Math.round((item.value / max) * 100);
              return (
                <div key={item.key} className="bar-chart__item">
                  <span className="bar-chart__label">{item.label}</span>
                  <span className="bar-chart__track">
                    <span className={`bar-chart__bar${item.value === 0 ? " is-zero" : ""}`} style={orientation === "horizontal" ? { width: `${pct}%` } : { height: `${pct}%` }} />
                  </span>
                  <span className="bar-chart__value">{format(item.value)}</span>
                </div>
              );
            })}
          </div>
          <details className="bar-chart__data">
            <summary>{t("charts.viewData")}</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("charts.item")}</th>
                  <th scope="col">{valueLabel || t("charts.value")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.key}>
                    <th scope="row">{item.label}</th>
                    <td>{format(item.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  );
}
