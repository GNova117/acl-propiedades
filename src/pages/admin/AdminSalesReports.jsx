import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import {
  availableYears,
  advisorPerformance,
  buildSaleRows,
  currentInventory,
  filterRows,
  inventorySeries,
  monthlyMatrix,
  pendingSales,
  profitSummary,
  salesTeam,
  todayIso,
} from "../../lib/salesReport";
import "./admin.css";
import "./AdminSalesReports.css";

const TABS = ["summary", "advisors", "profit", "sales"];
const EMPTY_FORM = { propertyId: "", advisorId: "", fecha: "" };
const INVENTORY_PREVIEW_ROWS = 10;

function useMonthLabels(language) {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language?.startsWith("en") ? "en-US" : "es-MX", { month: "short" });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)).replace(".", ""));
  }, [language]);
}

// Dos decimales: con pocas ventas al mes (0.11 vs 0.22) uno solo empata a casi todos.
const decimals = (n) => (n == null ? "—" : n.toLocaleString("es-MX", { maximumFractionDigits: 2 }));

function formatDate(iso, language) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(language?.startsWith("en") ? "en-US" : "es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function propertyLabel(p) {
  return p.code ? `${p.code} · ${p.title}` : p.title;
}

// Comparación contra el promedio del equipo: la dirección va también en la
// flecha y el signo, no solo en el color.
function VsTeam({ value }) {
  if (value == null) return <span className="sr-muted">—</span>;
  const pct = Math.round(value * 100);
  if (pct === 0) return <span className="sr-vs">= 0%</span>;
  return (
    <span className={`sr-vs ${pct > 0 ? "sr-vs--up" : "sr-vs--down"}`}>
      {pct > 0 ? "▲ +" : "▼ −"}
      {Math.abs(pct)}%
    </span>
  );
}

// Columnas agrupadas (subidas vs. vendidas por mes) hechas con HTML/CSS para
// que el texto no se encoja en pantallas chicas como haría un SVG escalado.
function InventoryChart({ series, monthLabels, t }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...series.flatMap((s) => [s.altas, s.ventas]));
  const step = Math.ceil(max / 4);
  const tickCount = Math.ceil(max / step);
  const top = step * tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * step);
  const empty = series.every((s) => s.altas === 0 && s.ventas === 0);

  return (
    <div className="card sr-panel">
      <div className="sr-panel__header">
        <h2>{t("salesReports.inventory.chartTitle")}</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAsTable((v) => !v)}>
          {asTable ? t("salesReports.viewChart") : t("salesReports.viewTable")}
        </button>
      </div>

      <div className="sr-legend">
        <span>
          <i className="sr-swatch sr-swatch--1" />
          {t("salesReports.inventory.added")}
        </span>
        <span>
          <i className="sr-swatch sr-swatch--2" />
          {t("salesReports.inventory.sold")}
        </span>
      </div>

      {empty ? (
        <p className="form-hint">{t("salesReports.inventory.noData")}</p>
      ) : asTable ? (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("salesReports.month")}</th>
                <th>{t("salesReports.inventory.added")}</th>
                <th>{t("salesReports.inventory.sold")}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.month}>
                  <td>{monthLabels[s.month]}</td>
                  <td>{s.altas}</td>
                  <td>{s.ventas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sr-chart" role="group" aria-label={t("salesReports.inventory.chartTitle")}>
          <div className="sr-chart__plot">
            {ticks.map((tick) => (
              <div key={tick} className="sr-chart__grid" style={{ bottom: `${(tick / top) * 100}%` }}>
                <span>{tick}</span>
              </div>
            ))}
            <div className="sr-chart__cols">
              {series.map((s) => (
                <div
                  key={s.month}
                  className="sr-chart__col"
                  tabIndex={0}
                  onMouseEnter={() => setHover(s.month)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(s.month)}
                  onBlur={() => setHover(null)}
                  aria-label={`${monthLabels[s.month]}: ${s.altas} ${t("salesReports.inventory.added")}, ${s.ventas} ${t("salesReports.inventory.sold")}`}
                >
                  <div className="sr-bar sr-bar--1" style={{ height: `${(s.altas / top) * 100}%`, minHeight: s.altas ? 3 : 0 }} />
                  <div className="sr-bar sr-bar--2" style={{ height: `${(s.ventas / top) * 100}%`, minHeight: s.ventas ? 3 : 0 }} />
                  {hover === s.month && (
                    <div className={`sr-tip ${s.month < 2 ? "sr-tip--left" : s.month > 9 ? "sr-tip--right" : ""}`} role="status">
                      <strong>{monthLabels[s.month]}</strong>
                      <span>
                        <i className="sr-swatch sr-swatch--1" />
                        {t("salesReports.inventory.added")}: {s.altas}
                      </span>
                      <span>
                        <i className="sr-swatch sr-swatch--2" />
                        {t("salesReports.inventory.sold")}: {s.ventas}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="sr-chart__months">
            {monthLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSalesReports() {
  const { t, i18n } = useTranslation();
  const { hasSection } = useAuth();
  const canSeeProfit = hasSection("liquidaciones");
  const [searchParams, setSearchParams] = useSearchParams();
  const monthLabels = useMonthLabels(i18n.language);

  const [data, setData] = useState({ properties: [], advisors: [], ventas: [], propertyTypes: [], liquidaciones: [], remodelProjects: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const now = new Date();
  const [tab, setTab] = useState("summary");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(null);
  const [type, setType] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null); // venta que se está corrigiendo
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      db.getProperties({}),
      db.getAdvisors(),
      db.getVentas(),
      db.getPropertyTypes(),
      canSeeProfit ? db.getLiquidaciones().catch(() => []) : [],
      canSeeProfit ? db.getRemodelProjects({}).catch(() => []) : [],
    ])
      .then(([properties, advisors, ventas, propertyTypes, liquidaciones, remodelProjects]) => {
        setData({ properties, advisors, ventas, propertyTypes, liquidaciones, remodelProjects });
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message || "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [canSeeProfit]);

  const { properties, advisors, ventas, propertyTypes, liquidaciones, remodelProjects } = data;
  const soldIds = useMemo(() => new Set(ventas.map((v) => v.property_id)), [ventas]);

  // "Registrar venta" desde la lista de Propiedades llega con ?vender=<id>.
  useEffect(() => {
    const target = searchParams.get("vender");
    if (!target || loading) return;
    const property = properties.find((p) => p.id === target);
    setTab("sales");
    if (property && !soldIds.has(property.id)) startRegister(property);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  const allRows = useMemo(
    () => buildSaleRows({ ventas, properties, advisors, liquidaciones, remodelProjects }),
    [ventas, properties, advisors, liquidaciones, remodelProjects]
  );
  const years = useMemo(() => availableYears(properties, ventas), [properties, ventas]);
  const yearRows = useMemo(() => filterRows(allRows, { year, type }), [allRows, year, type]);
  const periodRows = useMemo(() => filterRows(allRows, { year, month, type }), [allRows, year, month, type]);
  const team = useMemo(() => salesTeam(advisors, yearRows), [advisors, yearRows]);
  const matrix = useMemo(() => monthlyMatrix(allRows, team, { year, type }), [allRows, team, year, type]);
  const performance = useMemo(() => advisorPerformance(periodRows, team, { year, month }), [periodRows, team, year, month]);
  const profit = useMemo(() => profitSummary(periodRows), [periodRows]);
  const series = useMemo(() => inventorySeries(properties, allRows, { year, type }), [properties, allRows, year, type]);
  const inventory = useMemo(() => currentInventory(properties, ventas, { type }), [properties, ventas, type]);
  const pending = useMemo(() => pendingSales(properties, ventas), [properties, ventas]);

  const inventoryDays = inventory.map((i) => i.days).filter((d) => d != null);
  const avgInventoryDays = inventoryDays.length ? Math.round(inventoryDays.reduce((a, b) => a + b, 0) / inventoryDays.length) : null;
  const teamAvgPerMonth = performance.length ? performance.reduce((s, a) => s + a.perMonth, 0) / performance.length : 0;
  const maxPerMonth = Math.max(0.0001, ...performance.map((a) => a.perMonth));
  const maxMatrixCell = Math.max(1, ...matrix.lines.flatMap((l) => l.months));

  const visibleTabs = TABS.filter((key) => key !== "profit" || canSeeProfit);

  function startRegister(property) {
    const advisorId = (property.advisor_ids || []).find((id) => advisors.some((a) => a.id === id)) || "";
    setEditing(null);
    setFormError("");
    setForm({ propertyId: property.id, advisorId, fecha: todayIso() });
  }

  const startEdit = (row) => {
    setEditing(row);
    setFormError("");
    setForm({ propertyId: row.propertyId, advisorId: row.advisorId || "", fecha: row.fecha });
    setTab("sales");
  };

  const cancelForm = () => {
    setEditing(null);
    setFormError("");
    setForm(EMPTY_FORM);
  };

  const handleFormChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Al elegir propiedad se sugiere su primer asesor asignado (editable).
      if (field === "propertyId") {
        const property = properties.find((p) => p.id === value);
        next.advisorId = (property?.advisor_ids || []).find((id) => advisors.some((a) => a.id === id)) || "";
        if (!next.fecha) next.fecha = todayIso();
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.propertyId || !form.advisorId || !form.fecha) {
      setFormError(t("salesReports.form.required"));
      return;
    }
    if (form.fecha > todayIso()) {
      setFormError(t("salesReports.form.futureDate"));
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await db.saveVenta(form.propertyId, { advisor_id: form.advisorId, fecha_venta: form.fecha });
      cancelForm();
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
      load();
    } catch (err) {
      setFormError(err.message || t("salesReports.form.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async (row) => {
    if (!window.confirm(t("salesReports.confirmUndo", { title: row.property.title }))) return;
    try {
      await db.deleteVenta(row.id, row.propertyId);
      if (editing?.id === row.id) cancelForm();
      load();
    } catch (err) {
      window.alert(err.message || t("salesReports.form.saveError"));
    }
  };

  if (loading && ventas.length === 0 && properties.length === 0) {
    return <div className="empty-state">{t("common.loading")}</div>;
  }

  const selectableProperties = properties
    .filter((p) => !soldIds.has(p.id))
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));

  const periodLabel = month == null ? String(year) : `${monthLabels[month]} ${year}`;

  return (
    <div className="sales-reports">
      <div className="admin-header">
        <div>
          <h1>{t("salesReports.title")}</h1>
          <p className="form-hint">{t("salesReports.subtitle")}</p>
        </div>
      </div>

      {loadError && <p className="form-error">{t("salesReports.loadError", { error: loadError })}</p>}

      <div className="sr-filters card">
        <div className="form-field">
          <label htmlFor="sr-year">{t("salesReports.filters.year")}</label>
          <select id="sr-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="sr-month">{t("salesReports.filters.month")}</label>
          <select id="sr-month" value={month ?? ""} onChange={(e) => setMonth(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">{t("salesReports.filters.allYear")}</option>
            {monthLabels.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="sr-type">{t("salesReports.filters.type")}</label>
          <select id="sr-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t("salesReports.filters.allTypes")}</option>
            {propertyTypes.map((pt) => (
              <option key={pt.key} value={pt.key}>
                {propertyTypeLabel(t, pt.key)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pending.length > 0 && tab !== "sales" && (
        <div className="sr-alert" role="status">
          <span>{t("salesReports.pending.banner", { count: pending.length })}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab("sales")}>
            {t("salesReports.pending.review")}
          </button>
        </div>
      )}

      <div className="sr-tabs" role="tablist">
        {visibleTabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`sr-tab ${tab === key ? "sr-tab--active" : ""}`}
            onClick={() => setTab(key)}
          >
            {t(`salesReports.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <>
          <div className="admin-stats">
            <div className="card admin-stat-card">
              <span className="admin-stat-card__value">{periodRows.length}</span>
              <span className="admin-stat-card__label">{t("salesReports.kpi.sold", { period: periodLabel })}</span>
            </div>
            <div className="card admin-stat-card">
              <span className="admin-stat-card__value">{formatMXN(profit.volume)}</span>
              <span className="admin-stat-card__label">{t("salesReports.kpi.volume")}</span>
            </div>
            {canSeeProfit && (
              <div className="card admin-stat-card">
                <span className="admin-stat-card__value">{formatMXN(profit.utilidadOficina)}</span>
                <span className="admin-stat-card__label">
                  {t("salesReports.kpi.officeProfit")} · {t("salesReports.kpi.profitCoverage", { done: profit.liquidated, total: profit.sold })}
                </span>
              </div>
            )}
            <div className="card admin-stat-card">
              <span className="admin-stat-card__value">{inventory.length}</span>
              <span className="admin-stat-card__label">
                {t("salesReports.kpi.inventory")}
                {avgInventoryDays != null && ` · ${t("salesReports.kpi.inventoryAge", { days: avgInventoryDays })}`}
              </span>
            </div>
          </div>

          <InventoryChart series={series} monthLabels={monthLabels} t={t} />

          <div className="card sr-panel">
            <div className="sr-panel__header">
              <h2>{t("salesReports.inventory.currentTitle")}</h2>
            </div>
            {inventory.length === 0 ? (
              <p className="form-hint">{t("salesReports.inventory.currentEmpty")}</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("detail.code")}</th>
                      <th>{t("salesReports.table.property")}</th>
                      <th>{t("properties.type")}</th>
                      <th>{t("common.status")}</th>
                      <th>{t("salesReports.table.price")}</th>
                      <th>{t("salesReports.inventory.daysInInventory")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.slice(0, INVENTORY_PREVIEW_ROWS).map(({ property, days }) => (
                      <tr key={property.id}>
                        <td>{property.code || "—"}</td>
                        <td>{property.title}</td>
                        <td>{propertyTypeLabel(t, property.type)}</td>
                        <td>{t(`propertyStatus.${property.status}`)}</td>
                        <td>{formatMXN(property.price)}</td>
                        <td>{days == null ? "—" : days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {inventory.length > INVENTORY_PREVIEW_ROWS && (
              <p className="form-hint">
                {t("salesReports.inventory.more", { count: inventory.length - INVENTORY_PREVIEW_ROWS })}{" "}
                <Link to="/admin/propiedades">{t("admin.properties")}</Link>
              </p>
            )}
          </div>
        </>
      )}

      {tab === "advisors" && (
        <>
          <div className="card sr-panel">
            <div className="sr-panel__header">
              <h2>{t("salesReports.matrix.title", { year })}</h2>
            </div>
            {matrix.grandTotal === 0 ? (
              <p className="form-hint">{t("salesReports.noSales")}</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table sr-matrix">
                  <thead>
                    <tr>
                      <th>{t("salesReports.table.advisor")}</th>
                      {monthLabels.map((label) => (
                        <th key={label} className="sr-num">
                          {label}
                        </th>
                      ))}
                      <th className="sr-num">{t("salesReports.matrix.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.lines.map((line) => (
                      <tr key={line.id ?? "none"}>
                        <td>{line.name ?? t("salesReports.noAdvisor")}</td>
                        {line.months.map((n, i) => (
                          <td
                            key={i}
                            className={`sr-num ${n > 0 ? "sr-matrix__cell" : "sr-muted"}`}
                            style={n > 0 ? { "--v": n / maxMatrixCell } : undefined}
                          >
                            {n}
                          </td>
                        ))}
                        <td className="sr-num">
                          <strong>{line.total}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>
                        <strong>{t("salesReports.matrix.total")}</strong>
                      </td>
                      {matrix.totals.map((n, i) => (
                        <td key={i} className="sr-num">
                          <strong>{n}</strong>
                        </td>
                      ))}
                      <td className="sr-num">
                        <strong>{matrix.grandTotal}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="card sr-panel">
            <div className="sr-panel__header">
              <h2>{t("salesReports.performance.title", { period: periodLabel })}</h2>
            </div>
            <p className="form-hint">{t("salesReports.performance.explain", { avg: decimals(teamAvgPerMonth) })}</p>
            {performance.length === 0 ? (
              <p className="form-hint">{t("salesReports.noSales")}</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("salesReports.table.advisor")}</th>
                      <th>{t("salesReports.performance.sales")}</th>
                      <th>{t("salesReports.performance.perMonth")}</th>
                      <th>{t("salesReports.performance.vsTeam")}</th>
                      <th>{t("salesReports.performance.avgDays")}</th>
                      <th>{t("salesReports.performance.avgTicket")}</th>
                      <th>{t("salesReports.kpi.volume")}</th>
                      {canSeeProfit && <th>{t("salesReports.performance.commission")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td>{a.sales}</td>
                        <td>
                          <div className="sr-hbar">
                            <div className="sr-hbar__track">
                              <div className="sr-hbar__fill" style={{ width: `${(a.perMonth / maxPerMonth) * 100}%` }} />
                            </div>
                            <span>{decimals(a.perMonth)}</span>
                          </div>
                        </td>
                        <td>
                          <VsTeam value={a.vsTeam} />
                        </td>
                        <td>{a.avgDays == null ? "—" : Math.round(a.avgDays)}</td>
                        <td>{a.avgTicket == null ? "—" : formatMXN(a.avgTicket)}</td>
                        <td>{a.volume ? formatMXN(a.volume) : "—"}</td>
                        {canSeeProfit && <td>{a.commission == null ? "—" : formatMXN(a.commission)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "profit" && canSeeProfit && (
        <>
          <div className="admin-stats">
            <div className="card admin-stat-card">
              <span className="admin-stat-card__value">{formatMXN(profit.utilidadOficina)}</span>
              <span className="admin-stat-card__label">{t("salesReports.kpi.officeProfit")}</span>
            </div>
            <div className="card admin-stat-card">
              <span className="admin-stat-card__value">{formatMXN(profit.utilidadNeta)}</span>
              <span className="admin-stat-card__label">{t("salesReports.profit.netProfit")}</span>
            </div>
            <div className="card admin-stat-card">
              <span className="admin-stat-card__value">{formatMXN(profit.comisiones)}</span>
              <span className="admin-stat-card__label">{t("salesReports.profit.commissions")}</span>
            </div>
            <div className="card admin-stat-card">
              <span className="admin-stat-card__value">{formatMXN(profit.volume)}</span>
              <span className="admin-stat-card__label">{t("salesReports.kpi.volume")}</span>
            </div>
          </div>

          {profit.pending > 0 && (
            <div className="sr-alert" role="status">
              <span>{t("salesReports.profit.pendingNote", { count: profit.pending })}</span>
            </div>
          )}

          <div className="card sr-panel">
            <div className="sr-panel__header">
              <h2>{t("salesReports.profit.detailTitle", { period: periodLabel })}</h2>
            </div>
            {periodRows.length === 0 ? (
              <p className="form-hint">{t("salesReports.noSales")}</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("salesReports.table.date")}</th>
                      <th>{t("salesReports.table.property")}</th>
                      <th>{t("salesReports.table.advisor")}</th>
                      <th>{t("salesReports.table.price")}</th>
                      <th>{t("salesReports.kpi.officeProfit")}</th>
                      <th>{t("salesReports.profit.netProfit")}</th>
                      <th>{t("salesReports.profit.commissions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodRows.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDate(r.fecha, i18n.language)}</td>
                        <td>{r.property.title}</td>
                        <td>
                          {r.advisorName ?? t("salesReports.noAdvisor")}
                          {r.profit?.advisorMismatch && (
                            <span className="sr-warn" title={t("salesReports.profit.mismatch")}>
                              {" "}
                              ⚠
                            </span>
                          )}
                        </td>
                        <td>{formatMXN(r.price)}</td>
                        {r.profit ? (
                          <>
                            <td>{formatMXN(r.profit.utilidadOficina)}</td>
                            <td>{formatMXN(r.profit.utilidadNeta)}</td>
                            <td>{formatMXN(r.profit.totalComisiones)}</td>
                          </>
                        ) : (
                          <td colSpan={3}>
                            <Link to={`/admin/propiedades/${r.propertyId}/liquidacion`}>{t("salesReports.profit.captureLiquidation")}</Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="form-hint">{t("salesReports.profit.disclaimer")}</p>
          </div>
        </>
      )}

      {tab === "sales" && (
        <>
          {pending.length > 0 && (
            <div className="card sr-panel">
              <div className="sr-panel__header">
                <h2>{t("salesReports.pending.title")}</h2>
              </div>
              <p className="form-hint">{t("salesReports.pending.explain")}</p>
              <div className="admin-dashboard-panel__list">
                {pending.map((p) => (
                  <div key={p.id} className="admin-dashboard-panel__row">
                    <span>{propertyLabel(p)}</span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => startRegister(p)}>
                      {t("salesReports.registerSale")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form className="card admin-form sr-form" onSubmit={handleSubmit} noValidate>
            <h2 className="sr-form__title">{editing ? t("salesReports.form.editTitle") : t("salesReports.form.title")}</h2>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="sr-form-property">{t("salesReports.table.property")}</label>
                <select id="sr-form-property" value={form.propertyId} onChange={handleFormChange("propertyId")} disabled={Boolean(editing)}>
                  <option value="">—</option>
                  {editing && <option value={editing.propertyId}>{propertyLabel(editing.property)}</option>}
                  {selectableProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {propertyLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="sr-form-advisor">{t("salesReports.form.advisor")}</label>
                <select id="sr-form-advisor" value={form.advisorId} onChange={handleFormChange("advisorId")}>
                  <option value="">—</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="sr-form-date">{t("salesReports.form.date")}</label>
                <input id="sr-form-date" type="date" value={form.fecha} max={todayIso()} onChange={handleFormChange("fecha")} />
              </div>
            </div>
            {formError && <span className="form-error">{formError}</span>}
            <p className="form-hint">{t("salesReports.form.hint")}</p>
            <div className="admin-form__actions">
              {(editing || form.propertyId) && (
                <button type="button" className="btn btn-outline" onClick={cancelForm}>
                  {t("common.cancel")}
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner" /> : null}
                {savedNote ? "✓" : editing ? t("common.save") : t("salesReports.registerSale")}
              </button>
            </div>
          </form>

          <div className="card sr-panel">
            <div className="sr-panel__header">
              <h2>{t("salesReports.list.title", { period: periodLabel })}</h2>
            </div>
            {periodRows.length === 0 ? (
              <p className="form-hint">{t("salesReports.noSales")}</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("salesReports.table.date")}</th>
                      <th>{t("salesReports.table.property")}</th>
                      <th>{t("properties.type")}</th>
                      <th>{t("salesReports.table.advisor")}</th>
                      <th>{t("salesReports.table.price")}</th>
                      <th>{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodRows.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDate(r.fecha, i18n.language)}</td>
                        <td>{propertyLabel(r.property)}</td>
                        <td>{propertyTypeLabel(t, r.property.type)}</td>
                        <td>{r.advisorName ?? t("salesReports.noAdvisor")}</td>
                        <td>{formatMXN(r.price)}</td>
                        <td className="admin-table__actions">
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(r)}>
                            {t("common.edit")}
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleUndo(r)}>
                            {t("salesReports.undo")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
