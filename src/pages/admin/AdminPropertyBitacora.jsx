import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { exportToCsv } from "../../lib/csvExport";
import { computeMaterialsTotals } from "../../lib/materialsTotals";
import { useAuth } from "../../context/AuthContext";
import { todayIso } from "../../lib/salesReport";
import {
  FILE_ACCEPT_ATTR,
  LOG_CATEGORIES,
  MAX_FILE_MB,
  REMODEL_CATEGORY,
  amount,
  budgetStatus,
  expensesByCategory,
  formatIsoDate,
  formatMoney,
  groupByDay,
  logMonths,
  sumExpenses,
  toLogFields,
  validateLogFile,
  validateLogForm,
} from "../../lib/propertyLog";
import "./admin.css";
import "./AdminPropertyBitacora.css";

const emptyForm = (kind = "gasto", entry_date = todayIso()) => ({
  kind,
  entry_date,
  categoria: "",
  concepto: "",
  descripcion: "",
  monto: "",
  file: null,
});

const isImageEntry = (entry) =>
  entry.file_type ? entry.file_type.startsWith("image/") : /\.(jpe?g|png|webp|heic|heif)$/i.test(entry.file_name || "");

// Gastado contra un presupuesto: el estado va en texto + símbolo (no solo en
// el color de la barra) y sin presupuesto no se inventa un porcentaje.
function BudgetMeter({ title, spent, budget, emptyText, t, children }) {
  const status = budgetStatus(spent, budget);
  return (
    <div className="card pl-card">
      <h3>{title}</h3>
      <div className="pl-card__value">{formatMoney(spent)}</div>
      {status ? (
        <>
          <div
            className="pl-meter"
            role="meter"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={Number(budget)}
            aria-valuenow={Math.min(spent, Number(budget))}
          >
            <div className={`pl-meter__fill pl-meter__fill--${status.level}`} style={{ width: `${Math.min(100, status.pct)}%` }} />
          </div>
          <p className="pl-card__meta">{t("propertyLog.budget.of", { budget: formatMoney(budget), pct: Math.round(status.pct) })}</p>
          <p className={`pl-status pl-status--${status.level}`}>
            {status.level === "over"
              ? `▲ ${t("propertyLog.budget.over", { amount: formatMoney(-status.remaining) })}`
              : status.level === "warn"
                ? `⚠ ${t("propertyLog.budget.warn", { amount: formatMoney(status.remaining) })}`
                : `✓ ${t("propertyLog.budget.remaining", { amount: formatMoney(status.remaining) })}`}
          </p>
        </>
      ) : (
        <p className="form-hint">{emptyText}</p>
      )}
      {children}
    </div>
  );
}

export default function AdminPropertyBitacora({ listPath = "/admin/propiedades" }) {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { hasSection } = useAuth();

  const [property, setProperty] = useState(null);
  const [entries, setEntries] = useState([]);
  const [houseBudget, setHouseBudget] = useState(null);
  const [remodelProject, setRemodelProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [kindFilter, setKindFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [budgetDraft, setBudgetDraft] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([db.getPropertyById(id), db.getPropertyLog(id), db.getPropertyBudget(id), db.getRemodelProjectByProperty(id)])
      .then(([propertyData, logData, budgetData, remodelData]) => {
        setProperty(propertyData);
        setEntries(logData);
        setHouseBudget(budgetData);
        setBudgetDraft(budgetData == null ? "" : String(budgetData));
        setRemodelProject(remodelData);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message || "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const gastos = useMemo(() => entries.filter((e) => e.kind === "gasto"), [entries]);
  const totalSpent = useMemo(() => sumExpenses(entries), [entries]);
  const remodelSpent = useMemo(() => sumExpenses(entries, REMODEL_CATEGORY), [entries]);
  const remodelBudget = useMemo(() => computeMaterialsTotals(remodelProject?.materials).grandTotalInternal, [remodelProject]);
  const byCategory = useMemo(() => expensesByCategory(entries), [entries]);
  const months = useMemo(() => logMonths(entries), [entries]);
  const withoutReceipt = gastos.filter((e) => !e.file_path).length;

  // El acumulado de cada día se calcula sobre toda la historia; los filtros
  // solo recortan qué se ve (y el subtotal del día, que sí sigue al filtro).
  const days = useMemo(() => {
    return groupByDay(entries)
      .map((day) => {
        const visible = day.entries.filter(
          (e) => (!kindFilter || e.kind === kindFilter) && (!monthFilter || e.entry_date.startsWith(monthFilter))
        );
        return { ...day, entries: visible, dayTotal: sumExpenses(visible) };
      })
      .filter((day) => day.entries.length > 0);
  }, [entries, kindFilter, monthFilter]);

  const categoryLabel = (key) => (key ? t(`propertyLog.categories.${key}`, key) : "—");

  const setField = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const setKind = (kind) => {
    setForm((prev) => ({ ...prev, kind }));
    setErrors({});
  };

  const resetForm = (keep = form) => {
    setEditing(null);
    setErrors({});
    setFileError("");
    setSaveError("");
    setForm(emptyForm(keep.kind, keep.entry_date));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;
    const problem = validateLogFile(file);
    if (problem) {
      setFileError(t(`propertyLog.fileErrors.${problem}`, { mb: MAX_FILE_MB }));
      return;
    }
    setFileError("");
    setForm((prev) => ({ ...prev, file }));
  };

  const startEdit = (entry) => {
    setEditing(entry);
    setErrors({});
    setFileError("");
    setSaveError("");
    setForm({
      kind: entry.kind,
      entry_date: entry.entry_date,
      categoria: entry.categoria || "",
      concepto: entry.concepto || "",
      descripcion: entry.descripcion || "",
      monto: entry.monto == null ? "" : String(entry.monto),
      file: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateLogForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const fields = toLogFields(form);
      if (editing) await db.updatePropertyLogEntry(editing.id, fields);
      else await db.addPropertyLogEntry({ property_id: id, file: form.file, ...fields });
      resetForm(form);
      load();
    } catch (err) {
      setSaveError(err.message || t("propertyLog.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(t("propertyLog.confirmDelete"))) return;
    try {
      await db.deletePropertyLogEntry(entry.id);
      if (editing?.id === entry.id) resetForm();
      load();
    } catch (err) {
      window.alert(err.message || t("propertyLog.saveError"));
    }
  };

  const handleSaveBudget = async () => {
    const value = amount(budgetDraft);
    if (value < 0) return;
    setBudgetSaving(true);
    try {
      const saved = await db.savePropertyBudget(id, value);
      setHouseBudget(saved);
      setBudgetSaved(true);
      setTimeout(() => setBudgetSaved(false), 2000);
    } catch (err) {
      window.alert(err.message || t("propertyLog.saveError"));
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleExport = () => {
    exportToCsv(`bitacora-${property?.code || id}.csv`, entries.slice().reverse(), [
      { label: t("propertyLog.form.date"), key: "entry_date" },
      { label: t("propertyLog.table.type"), value: (e) => t(`propertyLog.kinds.${e.kind}`) },
      { label: t("propertyLog.form.category"), value: (e) => (e.categoria ? categoryLabel(e.categoria) : "") },
      { label: t("propertyLog.form.concept"), key: "concepto" },
      { label: t("propertyLog.form.description"), key: "descripcion" },
      { label: t("propertyLog.form.amount"), key: "monto" },
      { label: t("propertyLog.table.receipt"), key: "file_name" },
    ]);
  };

  if (loading && !property) return <div className="empty-state">{t("common.loading")}</div>;

  const isGasto = form.kind === "gasto";

  return (
    <div className="property-log">
      <div className="admin-header">
        <div>
          <h1>{t("propertyLog.title")}</h1>
          <p className="form-hint">{property ? `${property.code ? property.code + " · " : ""}${property.title}` : ""}</p>
        </div>
        <div className="admin-header__actions">
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={entries.length === 0}>
            {t("common.exportCsv")}
          </button>
          <Link to={listPath} className="btn btn-outline">
            {t("detail.back")}
          </Link>
        </div>
      </div>

      {loadError && <p className="form-error">{t("propertyLog.loadError", { error: loadError })}</p>}

      <div className="pl-summary">
        <div className="card pl-card">
          <h3>{t("propertyLog.summary.totalSpent")}</h3>
          <div className="pl-card__value">{formatMoney(totalSpent)}</div>
          <p className="pl-card__meta">
            {t("propertyLog.summary.count", { count: gastos.length })}
            {withoutReceipt > 0 && ` · ${t("propertyLog.summary.withoutReceipt", { count: withoutReceipt })}`}
          </p>
          {hasSection("liquidaciones") && (
            <p className="form-hint">
              {t("propertyLog.summary.inProfit")} <Link to={`/admin/propiedades/${id}/liquidacion`}>{t("liquidacion.button")}</Link>
            </p>
          )}
        </div>

        <BudgetMeter
          title={t("propertyLog.budget.houseTitle")}
          spent={totalSpent}
          budget={houseBudget}
          emptyText={t("propertyLog.budget.noHouseBudget")}
          t={t}
        >
          <div className="pl-budget-edit">
            <label htmlFor="pl-budget">{t("propertyLog.budget.setLabel")}</label>
            <div>
              <input id="pl-budget" type="number" min="0" inputMode="decimal" value={budgetDraft} onChange={(e) => setBudgetDraft(e.target.value)} />
              <button type="button" className="btn btn-outline btn-sm" onClick={handleSaveBudget} disabled={budgetSaving}>
                {budgetSaving ? <span className="spinner" /> : null}
                {budgetSaved ? "✓" : t("common.save")}
              </button>
            </div>
          </div>
        </BudgetMeter>

        <BudgetMeter
          title={t("propertyLog.budget.remodelTitle")}
          spent={remodelSpent}
          budget={remodelBudget}
          emptyText={t("propertyLog.budget.noRemodelBudget")}
          t={t}
        >
          <p className="form-hint">
            {t("propertyLog.budget.remodelHint")}
            {remodelProject && hasSection("remodelaciones") && (
              <>
                {" "}
                <Link to={`/admin/remodelaciones/${remodelProject.id}`}>{t("liquidacion.editInRemodel")}</Link>
              </>
            )}
          </p>
        </BudgetMeter>

        <div className="card pl-card">
          <h3>{t("propertyLog.summary.byCategory")}</h3>
          {byCategory.length === 0 ? (
            <p className="form-hint">{t("propertyLog.summary.noExpenses")}</p>
          ) : (
            <table className="pl-cat-table">
              <tbody>
                {byCategory.map((row) => (
                  <tr key={row.categoria}>
                    <td>{categoryLabel(row.categoria)}</td>
                    <td>{formatMoney(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <form className="card admin-form pl-form" onSubmit={handleSubmit} noValidate>
        <div className="pl-form__head">
          <h2>{editing ? t("propertyLog.form.editTitle") : t("propertyLog.form.title")}</h2>
          <div className="pl-seg" role="group" aria-label={t("propertyLog.table.type")}>
            {["gasto", "nota"].map((kind) => (
              <button
                key={kind}
                type="button"
                className={`pl-seg__btn ${form.kind === kind ? "pl-seg__btn--active" : ""}`}
                aria-pressed={form.kind === kind}
                onClick={() => setKind(kind)}
                disabled={Boolean(editing)}
              >
                {t(`propertyLog.kinds.${kind}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="pl-date">{t("propertyLog.form.date")}</label>
            <input id="pl-date" type="date" value={form.entry_date} onChange={setField("entry_date")} />
            {errors.entry_date && <span className="form-error">{t("contact.required")}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="pl-category">
              {t("propertyLog.form.category")}
              {!isGasto && ` (${t("propertyLog.form.optional")})`}
            </label>
            <select id="pl-category" value={form.categoria} onChange={setField("categoria")}>
              <option value="">—</option>
              {LOG_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {t(`propertyLog.categories.${key}`)}
                </option>
              ))}
            </select>
            {errors.categoria && <span className="form-error">{t("contact.required")}</span>}
          </div>
          {isGasto && (
            <div className="form-field">
              <label htmlFor="pl-amount">{t("propertyLog.form.amount")}</label>
              <input id="pl-amount" type="text" inputMode="decimal" placeholder="0.00" value={form.monto} onChange={setField("monto")} />
              {errors.monto && <span className="form-error">{t("propertyLog.form.amountInvalid")}</span>}
            </div>
          )}
        </div>

        {isGasto && (
          <div className="form-field">
            <label htmlFor="pl-concept">{t("propertyLog.form.concept")}</label>
            <input id="pl-concept" type="text" placeholder={t("propertyLog.form.conceptPlaceholder")} value={form.concepto} onChange={setField("concepto")} />
            {errors.concepto && <span className="form-error">{t("contact.required")}</span>}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="pl-description">
            {t("propertyLog.form.description")}
            {isGasto && ` (${t("propertyLog.form.optional")})`}
          </label>
          <textarea id="pl-description" rows={2} value={form.descripcion} onChange={setField("descripcion")} />
          {errors.descripcion && <span className="form-error">{t("contact.required")}</span>}
        </div>

        {isGasto && !editing && (
          <div className="form-field">
            <label>{t("propertyLog.form.receipt")}</label>
            <div className="pl-file-pick">
              <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                <input type="file" accept={FILE_ACCEPT_ATTR} onChange={handleFileChange} hidden />
                {form.file ? t("propertyLog.form.changeFile") : t("propertyLog.form.attach")}
              </label>
              {form.file && (
                <>
                  <span className="pl-file-pick__name">{form.file.name}</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm((p) => ({ ...p, file: null }))}>
                    {t("propertyLog.form.removeFile")}
                  </button>
                </>
              )}
            </div>
            <span className="form-hint">{t("propertyLog.form.receiptHint", { mb: MAX_FILE_MB })}</span>
            {fileError && <span className="form-error">{fileError}</span>}
          </div>
        )}
        {editing && editing.file_path && <p className="form-hint">{t("propertyLog.form.replaceReceiptHint")}</p>}

        {saveError && <span className="form-error">{saveError}</span>}

        <div className="admin-form__actions">
          {(editing || form.concepto || form.descripcion || form.monto || form.file) && (
            <button type="button" className="btn btn-outline" onClick={() => resetForm()} disabled={saving}>
              {t("common.cancel")}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {editing ? t("common.save") : t("propertyLog.form.add")}
          </button>
        </div>
      </form>

      <div className="card pl-panel">
        <div className="pl-panel__head">
          <h2>{t("propertyLog.timeline.title")}</h2>
          <div className="pl-filters">
            <div className="form-field">
              <select aria-label={t("propertyLog.table.type")} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
                <option value="">{t("propertyLog.timeline.allKinds")}</option>
                <option value="gasto">{t("propertyLog.kinds.gasto")}</option>
                <option value="nota">{t("propertyLog.kinds.nota")}</option>
              </select>
            </div>
            <div className="form-field">
              <select aria-label={t("propertyLog.timeline.month")} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                <option value="">{t("propertyLog.timeline.allMonths")}</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatIsoDate(`${m}-01`, i18n.language, { month: "long", year: "numeric" })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {days.length === 0 ? (
          <p className="form-hint">{entries.length === 0 ? t("propertyLog.timeline.empty") : t("propertyLog.timeline.noMatches")}</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table pl-table">
              <thead>
                <tr>
                  <th>{t("propertyLog.table.type")}</th>
                  <th>{t("propertyLog.form.category")}</th>
                  <th>{t("propertyLog.table.detail")}</th>
                  <th className="pl-num">{t("propertyLog.form.amount")}</th>
                  <th>{t("propertyLog.table.receipt")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              {days.map((day) => (
                <tbody key={day.date}>
                  <tr className="pl-day">
                    <th colSpan={6} scope="colgroup">
                      <span>{formatIsoDate(day.date, i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                      {day.dayTotal > 0 && (
                        <span className="pl-day__totals">
                          {t("propertyLog.timeline.dayTotal", { amount: formatMoney(day.dayTotal) })} ·{" "}
                          {t("propertyLog.timeline.cumulative", { amount: formatMoney(day.cumulative) })}
                        </span>
                      )}
                    </th>
                  </tr>
                  {day.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <span className={`pl-badge pl-badge--${entry.kind}`}>{t(`propertyLog.kinds.${entry.kind}`)}</span>
                      </td>
                      <td>{categoryLabel(entry.categoria)}</td>
                      <td>
                        {entry.kind === "gasto" ? (
                          <>
                            <strong>{entry.concepto}</strong>
                            {entry.descripcion && <div className="pl-muted">{entry.descripcion}</div>}
                          </>
                        ) : (
                          entry.descripcion
                        )}
                      </td>
                      <td className="pl-num">{entry.kind === "gasto" ? formatMoney(entry.monto) : "—"}</td>
                      <td>
                        {entry.file_path ? (
                          entry.signed_url ? (
                            <a href={entry.signed_url} target="_blank" rel="noreferrer" className="pl-file" title={entry.file_name}>
                              {isImageEntry(entry) ? <img className="pl-thumb" src={entry.signed_url} alt={entry.file_name || ""} /> : <span className="pl-pdf">PDF</span>}
                            </a>
                          ) : (
                            <span className="pl-muted">{entry.file_name}</span>
                          )
                        ) : entry.kind === "gasto" ? (
                          <span className="pl-missing">{t("propertyLog.noReceipt")}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="admin-table__actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(entry)}>
                          {t("common.edit")}
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(entry)}>
                          {t("common.delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
