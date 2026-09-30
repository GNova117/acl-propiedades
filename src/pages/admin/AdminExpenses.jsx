import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import { MUNICIPALITIES, PROFILES, TEMPLATE_CONCEPTS, computeBreakdown, rateText, toConceptFields, toReportItems, validateConcept } from "../../lib/expenseBreakdown";
import "./admin.css";

const emptyForm = (municipality, profile) => ({ municipality, profile, name: "", kind: "fixed", base: "price", value: "", sort_order: 0 });

// Desglose de gastos por municipio y perfil (comprador / vendedor). Uso interno:
// los rubros y tarifas los captura el equipo aquí mismo y la pantalla solo
// calcula con los rubros del municipio y perfil elegidos, así un comprador nunca
// ve rubros de vendedor ni de otra plaza, y no existe ningún dato de utilidad.
export default function AdminExpenses() {
  const { t } = useTranslation();
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [municipality, setMunicipality] = useState(MUNICIPALITIES[0]);
  const [profile, setProfile] = useState(PROFILES[0]);
  const [price, setPrice] = useState("");
  const [credit, setCredit] = useState("");
  const [houseName, setHouseName] = useState(""); // solo para el encabezado del PDF/copiado: no se guarda
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(null); // { id?, ...campos } mientras se agrega o edita
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // { text, error }

  const load = () =>
    db
      .getExpenseConcepts()
      .then((rows) => {
        setConcepts(rows);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message || "Error"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    db.getProperties({})
      .then(setProperties)
      .catch(() => {});
  }, []);

  const propertyLabel = (p) => [p.code, p.title].filter(Boolean).join(" · ");

  const breakdown = useMemo(
    () => computeBreakdown(concepts, { municipality, profile, price: Number(price) || 0, credit: Number(credit) || 0 }),
    [concepts, municipality, profile, price, credit]
  );

  const submit = async (event) => {
    event.preventDefault();
    const errors = validateConcept(form);
    if (errors.name) return setFormError(t("expenses.errName"));
    if (errors.value) return setFormError(t("expenses.errValue"));
    try {
      await db.saveExpenseConcept(toConceptFields(form), form.id || null);
      setForm(null);
      setFormError("");
      load();
    } catch (err) {
      setFormError(t("expenses.saveError", { error: err.message || "Error" }));
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t("expenses.confirmDelete"))) return;
    try {
      await db.deleteExpenseConcept(id);
      load();
    } catch (err) {
      window.alert(t("expenses.saveError", { error: err.message || "Error" }));
    }
  };

  const loadTemplate = async () => {
    if (!window.confirm(t("expenses.confirmTemplate", { municipality }))) return;
    const have = new Set(concepts.filter((c) => c.municipality === municipality).map((c) => `${c.profile}|${c.name}`));
    const rows = TEMPLATE_CONCEPTS.filter((c) => !have.has(`${c.profile}|${c.name}`)).map((c, i) => ({ ...c, municipality, sort_order: i }));
    if (rows.length === 0) return;
    try {
      await db.addExpenseConcepts(rows);
      load();
    } catch (err) {
      window.alert(t("expenses.saveError", { error: err.message || "Error" }));
    }
  };

  const copyText = async () => {
    const lines = [
      houseName.trim() ? t("expenses.copyHeaderHouse", { house: houseName.trim(), profile: t(`expenses.${profile}`), municipality }) : t("expenses.copyHeader", { profile: t(`expenses.${profile}`), municipality }),
      ...breakdown.rows.map((r) => `• ${r.name}: ${formatMXN(r.amount)}`),
      `${t("expenses.total")}: ${formatMXN(breakdown.total)}`,
      t("expenses.copyNote"),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(lines.join("\n"));
    }
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadExpenseBreakdownPdf } = await import("../../lib/expenseBreakdownPdf");
      const priceValue = Number(price) || 0;
      const creditValue = Number(credit) || 0;
      await downloadExpenseBreakdownPdf(
        {
          title: t("expenses.pdf.title"),
          profileLine: `${t(`expenses.${profile}`)} · ${municipality}`,
          detailLines: [
            houseName.trim() && `${t("expenses.house")}: ${houseName.trim()}`,
            priceValue > 0 && `${t("expenses.price")}: ${formatMXN(priceValue)}`,
            profile === "comprador" && creditValue > 0 && `${t("expenses.creditAmount")}: ${formatMXN(creditValue)}`,
          ].filter(Boolean),
          generatedLine: t("expenses.pdf.generated", { date: new Date().toLocaleDateString("es-MX", { dateStyle: "long" }) }),
          colConcept: t("expenses.concept"),
          colRate: t("expenses.rate"),
          colAmount: t("expenses.amount"),
          totalLabel: t("expenses.total"),
          total: formatMXN(breakdown.total),
          note: t("expenses.copyNote"),
          empty: t("expenses.empty"),
          rows: breakdown.rows.map((r) => ({ name: r.name, rate: rateText(r, t), amount: formatMXN(r.amount) })),
        },
        `desglose-gastos-${profile}-${municipality}`
      );
    } catch (err) {
      window.alert(err.message || t("expenses.pdf.error"));
    } finally {
      setPdfBusy(false);
    }
  };

  // Congela el desglose de ESTA casa tal como está ahora mismo (rubros con su
  // tarifa y monto exactos). Si más adelante cambia la tarifa de un rubro en el
  // catálogo, este registro se queda como está: es la copia de lo que se le
  // mostró a esa casa ese día.
  const saveReport = async () => {
    const house = houseName.trim();
    if (!house) return setSaveMessage({ text: t("expenses.houseRequired"), error: true });
    if (breakdown.rows.length === 0) return;
    setSavingReport(true);
    setSaveMessage(null);
    try {
      const matched = properties.find((p) => propertyLabel(p) === house);
      await db.saveExpenseReport({
        property_id: matched?.id || null,
        house_name: house,
        municipality,
        profile,
        price: Number(price) || null,
        credit: Number(credit) || null,
        total: breakdown.total,
        items: toReportItems(breakdown.rows),
      });
      setSaveMessage({ text: t("expenses.history.saved"), error: false });
    } catch (err) {
      setSaveMessage({ text: t("expenses.saveError", { error: err.message || "Error" }), error: true });
    } finally {
      setSavingReport(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("expenses.title")}</h1>
          <p className="form-hint">{t("expenses.subtitle")}</p>
        </div>
      </div>

      {loadError && <p className="form-error">{t("expenses.loadError", { error: loadError })}</p>}

      <div className="card" style={{ padding: "1rem", marginBottom: "1.25rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="form-field">
          <label htmlFor="ex-muni">{t("expenses.municipality")}</label>
          <select id="ex-muni" value={municipality} onChange={(e) => setMunicipality(e.target.value)}>
            {MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ex-profile">{t("expenses.profile")}</label>
          <select id="ex-profile" value={profile} onChange={(e) => setProfile(e.target.value)}>
            {PROFILES.map((p) => (
              <option key={p} value={p}>
                {t(`expenses.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ex-price">{t("expenses.price")}</label>
          <input id="ex-price" type="number" min="0" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        {profile === "comprador" && (
          <div className="form-field">
            <label htmlFor="ex-credit">{t("expenses.credit")}</label>
            <input id="ex-credit" type="number" min="0" inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} />
          </div>
        )}
        <div className="form-field">
          <label htmlFor="ex-house">{t("expenses.house")}</label>
          <input id="ex-house" type="text" list="ex-house-options" value={houseName} onChange={(e) => setHouseName(e.target.value)} placeholder={t("expenses.housePlaceholder")} />
          <datalist id="ex-house-options">
            {properties.map((p) => (
              <option key={p.id} value={propertyLabel(p)} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="card admin-table-wrapper" style={{ marginBottom: "0.5rem" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("expenses.concept")}</th>
              <th>{t("expenses.rate")}</th>
              <th>{t("expenses.amount")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>{t("common.loading")}</td>
              </tr>
            ) : breakdown.rows.length === 0 ? (
              <tr>
                <td colSpan={4}>{t("expenses.empty")}</td>
              </tr>
            ) : (
              breakdown.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{rateText(r, t)}</td>
                  <td>{formatMXN(r.amount)}</td>
                  <td className="admin-table__actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm({ ...r, value: String(r.value) })}>
                      {t("common.edit")}
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {breakdown.rows.length > 0 && (
            <tfoot>
              <tr>
                <th colSpan={2}>{t("expenses.total")}</th>
                <th colSpan={2}>{formatMXN(breakdown.total)}</th>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="form-hint">{t("expenses.note")}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button type="button" className="btn btn-primary" onClick={() => setForm(emptyForm(municipality, profile))}>
          {t("expenses.add")}
        </button>
        <button type="button" className="btn btn-outline" onClick={copyText} disabled={breakdown.rows.length === 0}>
          {copied ? `✓ ${t("expenses.copied")}` : t("expenses.copy")}
        </button>
        <button type="button" className="btn btn-outline" onClick={downloadPdf} disabled={breakdown.rows.length === 0 || pdfBusy}>
          {pdfBusy ? <span className="spinner" /> : null}
          {t("expenses.pdf.download")}
        </button>
        <button type="button" className="btn btn-outline" onClick={loadTemplate} title={t("expenses.templateHint")}>
          {t("expenses.loadTemplate", { municipality })}
        </button>
        <button type="button" className="btn btn-outline" onClick={saveReport} disabled={breakdown.rows.length === 0 || savingReport} title={t("expenses.history.saveHint")}>
          {savingReport ? <span className="spinner" /> : null}
          {t("expenses.history.save")}
        </button>
        <Link to="/admin/gastos/historial" className="btn btn-outline">
          {t("expenses.history.view")}
        </Link>
      </div>

      {saveMessage && <p className={saveMessage.error ? "form-error" : "form-hint"}>{saveMessage.text}</p>}

      {form && (
        <form className="card" style={{ padding: "1rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }} onSubmit={submit}>
          {form.id && (
            <p className="form-hint" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
              {t("expenses.lockedHint")}
            </p>
          )}
          <div className="form-field">
            <label htmlFor="ex-name">{t("expenses.name")}</label>
            <input id="ex-name" type="text" value={form.name} onChange={set("name")} readOnly={Boolean(form.id)} tabIndex={form.id ? -1 : 0} />
          </div>
          <div className="form-field">
            <label htmlFor="ex-kind">{t("expenses.kind")}</label>
            <select id="ex-kind" value={form.kind} onChange={set("kind")} disabled={Boolean(form.id)}>
              <option value="fixed">{t("expenses.fixed")}</option>
              <option value="percent">{t("expenses.percent")}</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="ex-value">{t("expenses.value")}</label>
            <input id="ex-value" type="number" min="0" step="any" inputMode="decimal" value={form.value} onChange={set("value")} autoFocus={Boolean(form.id)} />
          </div>
          {form.kind === "percent" && (
            <div className="form-field">
              <label htmlFor="ex-base">{t("expenses.base")}</label>
              <select id="ex-base" value={form.base} onChange={set("base")} disabled={Boolean(form.id)}>
                <option value="price">{t("expenses.basePrice")}</option>
                <option value="credit">{t("expenses.baseCredit")}</option>
              </select>
            </div>
          )}
          {formError && <p className="form-error" style={{ gridColumn: "1 / -1" }}>{formError}</p>}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary">
              {t("expenses.save")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => { setForm(null); setFormError(""); }}>
              {t("expenses.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
