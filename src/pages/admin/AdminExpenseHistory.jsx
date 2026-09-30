import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import { MUNICIPALITIES, PROFILES, creditRefund, rateText, toReportItems } from "../../lib/expenseBreakdown";
import { formatVisitDateTime } from "../../lib/visitReport";
import "./admin.css";

// Historial de desgloses guardados por casa: cada fila es la copia exacta que
// se guardó ese día (rubros con nombre, tarifa y monto). Aunque después cambie
// una tarifa en /admin/gastos, estos registros no se recalculan: el PDF de un
// registro viejo sale con lo mismo que se le mostró a esa casa en su momento.
export default function AdminExpenseHistory() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");
  const [house, setHouse] = useState(searchParams.get("casa") || "");
  const [municipality, setMunicipality] = useState("");
  const [profile, setProfile] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState(null);
  const [editing, setEditing] = useState(null); // copia editable del registro, o null
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const load = () =>
    db
      .getExpenseReports()
      .then((rows) => {
        setReports(rows);
        setError("");
      })
      .catch((err) => setError(err.message || "Error"));

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!reports) return [];
    const needle = house.trim().toLowerCase();
    return reports.filter(
      (r) => (!needle || r.house_name.toLowerCase().includes(needle)) && (!municipality || r.municipality === municipality) && (!profile || r.profile === profile)
    );
  }, [reports, house, municipality, profile]);

  const remove = async (id) => {
    if (!window.confirm(t("expenses.history.confirmDelete"))) return;
    try {
      await db.deleteExpenseReport(id);
      load();
    } catch (err) {
      window.alert(err.message || "Error");
    }
  };

  const editTotal = useMemo(() => (editing ? editing.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0) : 0), [editing]);
  const editRefund = useMemo(
    () =>
      editing && editing.profile === "comprador" && Number(editing.credit) > 0
        ? creditRefund({ price: Number(editing.price) || 0, credit: Number(editing.credit) || 0, totalExpenses: editTotal })
        : null,
    [editing, editTotal]
  );

  const startEdit = (report) => {
    setEditError("");
    setEditing({ ...report, price: report.price ?? "", credit: report.credit ?? "", items: report.items.map((it) => ({ ...it })) });
  };

  const setEditField = (key) => (e) => setEditing((r) => ({ ...r, [key]: e.target.value }));

  const setItemAmount = (index, value) =>
    setEditing((r) => ({ ...r, items: r.items.map((it, i) => (i === index ? { ...it, amount: value } : it)) }));

  // Vuelve a calcular con las cifras de precio/crédito de ARRIBA los rubros que
  // son porcentaje (con la tarifa que se guardó, no la del catálogo actual); los
  // de monto fijo no se tocan porque no dependen del precio ni del crédito.
  const recalculate = () => {
    const priceValue = Number(editing.price) || 0;
    const creditValue = Number(editing.credit) || 0;
    setEditing((r) => ({
      ...r,
      items: r.items.map((it) => {
        if (it.kind !== "percent") return it;
        const base = it.base === "credit" ? creditValue : priceValue;
        return { ...it, amount: Math.round(((base * (Number(it.rate_value) || 0)) / 100) * 100) / 100 };
      }),
    }));
  };

  const saveEdit = async () => {
    if (!editing.house_name.trim()) return setEditError(t("expenses.houseRequired"));
    setSavingEdit(true);
    setEditError("");
    try {
      await db.updateExpenseReport(editing.id, {
        house_name: editing.house_name.trim(),
        price: Number(editing.price) || null,
        credit: Number(editing.credit) || null,
        total: editTotal,
        items: toReportItems(editing.items.map((it) => ({ ...it, value: it.rate_value }))),
      });
      setEditing(null);
      load();
    } catch (err) {
      setEditError(t("expenses.saveError", { error: err.message || "Error" }));
    } finally {
      setSavingEdit(false);
    }
  };

  const viewPdf = async (report) => {
    setPdfBusyId(report.id);
    try {
      const { downloadExpenseBreakdownPdf } = await import("../../lib/expenseBreakdownPdf");
      await downloadExpenseBreakdownPdf(
        {
          title: t("expenses.pdf.title"),
          profileLine: `${t(`expenses.${report.profile}`)} · ${report.municipality}`,
          detailLines: [
            `${t("expenses.house")}: ${report.house_name}`,
            report.price > 0 && `${t("expenses.price")}: ${formatMXN(report.price)}`,
            report.profile === "comprador" && report.credit > 0 && `${t("expenses.creditAmount")}: ${formatMXN(report.credit)}`,
          ].filter(Boolean),
          generatedLine: t("expenses.pdf.generated", { date: formatVisitDateTime(report.created_at, i18n.language) }),
          colConcept: t("expenses.concept"),
          colRate: t("expenses.rate"),
          colAmount: t("expenses.amount"),
          totalLabel: t("expenses.total"),
          total: formatMXN(report.total),
          summaryLines:
            report.profile === "comprador" && Number(report.credit) > 0
              ? (() => {
                  const r = creditRefund({ price: Number(report.price) || 0, credit: Number(report.credit) || 0, totalExpenses: report.total });
                  return [
                    { label: t("expenses.refund.surplus"), value: formatMXN(r.surplus) },
                    r.refund > 0
                      ? { label: t("expenses.refund.refund"), value: formatMXN(r.refund) }
                      : r.shortfall > 0
                        ? { label: t("expenses.refund.shortfall"), value: formatMXN(r.shortfall) }
                        : null,
                  ].filter(Boolean);
                })()
              : [],
          note: t("expenses.copyNote"),
          empty: t("expenses.empty"),
          rows: report.items.map((it) => ({ name: it.name, rate: rateText(it, t), amount: formatMXN(it.amount) })),
        },
        `desglose-gastos-${report.profile}-${report.house_name}`
      );
    } catch (err) {
      window.alert(err.message || t("expenses.pdf.error"));
    } finally {
      setPdfBusyId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("expenses.history.title")}</h1>
          <p className="form-hint">{t("expenses.history.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          <Link to="/admin/gastos" className="btn btn-outline">
            {t("expenses.history.backToExpenses")}
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1.25rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="form-field">
          <label htmlFor="eh-house">{t("expenses.history.searchHouse")}</label>
          <input
            id="eh-house"
            type="text"
            value={house}
            onChange={(e) => {
              setHouse(e.target.value);
              setSearchParams(e.target.value ? { casa: e.target.value } : {}, { replace: true });
            }}
          />
        </div>
        <div className="form-field">
          <label htmlFor="eh-muni">{t("expenses.municipality")}</label>
          <select id="eh-muni" value={municipality} onChange={(e) => setMunicipality(e.target.value)}>
            <option value="">{t("expenses.history.allMunicipalities")}</option>
            {MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="eh-profile">{t("expenses.profile")}</label>
          <select id="eh-profile" value={profile} onChange={(e) => setProfile(e.target.value)}>
            <option value="">{t("expenses.history.allProfiles")}</option>
            {PROFILES.map((p) => (
              <option key={p} value={p}>
                {t(`expenses.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="form-error">{t("expenses.history.loadError", { error })}</p>}

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("expenses.history.colDate")}</th>
              <th>{t("expenses.history.colHouse")}</th>
              <th>{t("expenses.history.colMunicipality")}</th>
              <th>{t("expenses.history.colProfile")}</th>
              <th>{t("expenses.history.colTotal")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {!reports ? (
              <tr>
                <td colSpan={6}>{t("common.loading")}</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6}>{reports.length === 0 ? t("expenses.history.empty") : t("expenses.history.noMatches")}</td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id}>
                  <td>{formatVisitDateTime(r.created_at, i18n.language)}</td>
                  <td>{r.house_name}</td>
                  <td>{r.municipality}</td>
                  <td>{t(`expenses.${r.profile}`)}</td>
                  <td>{formatMXN(r.total)}</td>
                  <td className="admin-table__actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(r)}>
                      {t("common.edit")}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => viewPdf(r)} disabled={pdfBusyId === r.id}>
                      {pdfBusyId === r.id ? <span className="spinner" /> : null}
                      {t("expenses.history.viewPdf")}
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card" style={{ padding: "1rem", marginTop: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>{t("expenses.history.editTitle")}</h2>
          <p className="form-hint">{t("expenses.history.editHint")}</p>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label htmlFor="eh-edit-house">{t("expenses.house")}</label>
              <input id="eh-edit-house" type="text" value={editing.house_name} onChange={setEditField("house_name")} />
            </div>
            <div className="form-field">
              <label>{t("expenses.municipality")}</label>
              <p className="form-hint" style={{ margin: 0 }}>
                {editing.municipality} · {t(`expenses.${editing.profile}`)}
              </p>
            </div>
            <div className="form-field">
              <label htmlFor="eh-edit-price">{t("expenses.price")}</label>
              <input id="eh-edit-price" type="number" min="0" inputMode="decimal" value={editing.price} onChange={setEditField("price")} />
            </div>
            {editing.profile === "comprador" && (
              <div className="form-field">
                <label htmlFor="eh-edit-credit">{t("expenses.credit")}</label>
                <input id="eh-edit-credit" type="number" min="0" inputMode="decimal" value={editing.credit} onChange={setEditField("credit")} />
              </div>
            )}
          </div>

          <div className="admin-table-wrapper" style={{ marginBottom: "0.5rem" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("expenses.concept")}</th>
                  <th>{t("expenses.rate")}</th>
                  <th>{t("expenses.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {editing.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td>
                    <td>{rateText(it, t)}</td>
                    <td>
                      <input type="number" min="0" step="any" inputMode="decimal" value={it.amount} onChange={(e) => setItemAmount(i, e.target.value)} style={{ maxWidth: 140 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={2}>{t("expenses.total")}</th>
                  <th>{formatMXN(editTotal)}</th>
                </tr>
              </tfoot>
            </table>
          </div>

          {editRefund && (
            <p className="form-hint">
              {t("expenses.refund.surplus")}: {formatMXN(editRefund.surplus)}
              {editRefund.refund > 0 && ` · ${t("expenses.refund.refund")}: ${formatMXN(editRefund.refund)}`}
              {editRefund.shortfall > 0 && ` · ${t("expenses.refund.shortfall")}: ${formatMXN(editRefund.shortfall)}`}
            </p>
          )}

          {editError && <p className="form-error">{editError}</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button type="button" className="btn btn-outline" onClick={recalculate} title={t("expenses.history.recalculateHint")}>
              {t("expenses.history.recalculate")}
            </button>
            <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? <span className="spinner" /> : null}
              {t("expenses.save")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
              {t("expenses.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
