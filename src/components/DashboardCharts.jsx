import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { useAuth } from "../context/useAuth.js";
import { monthlySales, sourceSeries, stageSeries } from "../lib/dashboardCharts";
import BarChart from "./charts/BarChart";

// Gráficas del Dashboard: prospectos por etapa (el embudo de hoy), ventas por mes (últimos 12) y prospectos por fuente.
// Cada una solo con el apartado que necesita (Prospectos / Reportes); un asesor ve las de SUS prospectos (RLS). Sin
// librerías: ver components/charts/BarChart.jsx.
export default function DashboardCharts() {
  const { t, i18n } = useTranslation();
  const { hasSection } = useAuth();
  const canProspects = hasSection("prospectos");
  const canSales = hasSection("reportes");
  const [prospects, setProspects] = useState(null);
  const [ventas, setVentas] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (canProspects) db.getProspects().then((rows) => !cancelled && setProspects(rows)).catch(() => !cancelled && setProspects([]));
    if (canSales) db.getVentas().then((rows) => !cancelled && setVentas(rows)).catch(() => !cancelled && setVentas([]));
    return () => {
      cancelled = true;
    };
  }, [canProspects, canSales]);

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
  const stages = useMemo(() => (prospects ? stageSeries(prospects) : []), [prospects]);
  const sources = useMemo(() => (prospects ? sourceSeries(prospects) : []), [prospects]);
  const sales = useMemo(() => (ventas ? monthlySales(ventas) : []), [ventas]);
  const monthLabel = (s) => new Date(s.year, s.month, 1).toLocaleDateString(locale, { month: "short" }).replace(".", "");

  if (!canProspects && !canSales) return null;

  const stageItems = stages.map((s) => ({ key: s.key, value: s.value, label: t(`prospects.stages.${s.key}`) }));
  const sourceItems = sources.map((s) => ({ key: s.key, value: s.value, label: s.key === "__rest" ? t("charts.otherSources") : t(`prospects.sources.${s.key}`, { defaultValue: s.key }) }));
  const salesItems = sales.map((s) => ({ key: s.key, value: s.value, label: monthLabel(s) }));
  const salesTotal = sales.reduce((n, s) => n + s.value, 0);

  return (
    <section className="admin-charts" aria-label={t("charts.title")}>
      <div className="admin-dashboard-panels">
        {canProspects && prospects && (
          <>
            <div className="card admin-dashboard-panel">
              <div className="admin-dashboard-panel__header">
                <h2>{t("charts.stagesTitle")}</h2>
                <Link to="/admin/estadisticas" className="btn btn-outline btn-sm">
                  {t("charts.fullFunnel")}
                </Link>
              </div>
              <BarChart
                title={t("charts.stagesSubtitle")}
                items={stageItems}
                valueLabel={t("charts.prospects")}
                ariaLabel={t("charts.stagesAria", { summary: stageItems.map((i) => `${i.label}: ${i.value}`).join(", ") })}
                emptyText={t("charts.noProspects")}
              />
            </div>
            <div className="card admin-dashboard-panel">
              <div className="admin-dashboard-panel__header">
                <h2>{t("charts.sourcesTitle")}</h2>
              </div>
              <BarChart
                title={t("charts.sourcesSubtitle")}
                items={sourceItems}
                valueLabel={t("charts.prospects")}
                ariaLabel={t("charts.sourcesAria", { summary: sourceItems.map((i) => `${i.label}: ${i.value}`).join(", ") })}
                emptyText={t("charts.noProspects")}
              />
            </div>
          </>
        )}
        {canSales && ventas && (
          <div className="card admin-dashboard-panel">
            <div className="admin-dashboard-panel__header">
              <h2>{t("charts.salesTitle")}</h2>
              <Link to="/admin/reportes" className="btn btn-outline btn-sm">
                {t("charts.salesReport")}
              </Link>
            </div>
            <BarChart
              title={t("charts.salesSubtitle", { count: salesTotal })}
              items={salesItems}
              orientation="vertical"
              valueLabel={t("charts.sales")}
              ariaLabel={t("charts.salesAria", { summary: salesItems.filter((i) => i.value > 0).map((i) => `${i.label}: ${i.value}`).join(", ") || t("charts.none") })}
              emptyText={t("charts.noSales")}
            />
          </div>
        )}
      </div>
    </section>
  );
}
