import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatMXN } from "../lib/format";
import "./MaterialsTable.css";

function uid() {
  return `mat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_ROW = {
  material_id: "",
  name: "",
  category: "",
  unit: "",
  quantity: "",
  unit_price_internal: "",
  unit_price_external: "",
};

function lineTotal(row, priceField) {
  const price = row[priceField];
  if (price === "" || price == null) return null;
  const qty = Number(row.quantity) || 0;
  return qty * Number(price);
}

function lineSavings(row) {
  const totalInternal = lineTotal(row, "unit_price_internal");
  const totalExternal = lineTotal(row, "unit_price_external");
  if (totalInternal == null || totalExternal == null) return null;
  return totalExternal - totalInternal;
}

export default function MaterialsTable({ materials, onChange }) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    db.getMaterialsCatalog({ activeOnly: true }).then((data) => {
      setCatalog(data);
      setLoadingCatalog(false);
    });
  }, []);

  const updateRow = (id, field, value) => {
    onChange((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const selectMaterial = (id, materialId) => {
    const item = catalog.find((m) => m.id === materialId);
    onChange((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              material_id: materialId,
              name: item?.name || "",
              category: item?.category || "",
              unit: item?.unit || "",
              unit_price_internal: item?.unit_price_internal ?? "",
              unit_price_external: item?.unit_price_external ?? "",
            }
          : row
      )
    );
  };

  const addRow = () => onChange((prev) => [...prev, { id: uid(), ...EMPTY_ROW }]);
  const removeRow = (id) => onChange((prev) => prev.filter((row) => row.id !== id));

  const grandTotalInternal = materials.reduce((sum, row) => sum + (lineTotal(row, "unit_price_internal") || 0), 0);
  const grandTotalExternal = materials.reduce((sum, row) => sum + (lineTotal(row, "unit_price_external") || 0), 0);
  const totalSavings = grandTotalExternal - grandTotalInternal;
  const hasAnyPrice = materials.some(
    (row) =>
      (row.unit_price_internal !== "" && row.unit_price_internal != null) ||
      (row.unit_price_external !== "" && row.unit_price_external != null)
  );

  if (loadingCatalog) return <p className="form-hint">{t("common.loading")}</p>;

  if (catalog.length === 0) {
    return (
      <p className="form-hint">
        {t("remodelCalculator.emptyCatalog")}{" "}
        <Link to="/admin/materiales/nuevo">{t("remodelCalculator.manageCatalog")}</Link>
      </p>
    );
  }

  return (
    <div className="materials-table">
      {materials.length === 0 ? (
        <p className="form-hint">{t("remodelCalculator.noMaterials")}</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table materials-table__table">
            <thead>
              <tr>
                <th>{t("remodelCalculator.material")}</th>
                <th>{t("remodelCalculator.category")}</th>
                <th>{t("remodelCalculator.unit")}</th>
                <th>{t("remodelCalculator.quantity")}</th>
                <th>{t("remodelCalculator.unitPriceInternal")}</th>
                <th>{t("remodelCalculator.unitPriceExternal")}</th>
                <th>{t("remodelCalculator.totalInternal")}</th>
                <th>{t("remodelCalculator.totalExternal")}</th>
                <th>{t("remodelCalculator.savings")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {materials.map((row) => {
                const totalInternal = lineTotal(row, "unit_price_internal");
                const totalExternal = lineTotal(row, "unit_price_external");
                const savings = lineSavings(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <select value={row.material_id} onChange={(e) => selectMaterial(row.id, e.target.value)}>
                        <option value="">{t("remodelCalculator.selectMaterial")}</option>
                        {catalog.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="materials-table__readonly">{row.category || "—"}</td>
                    <td className="materials-table__readonly">{row.unit || "—"}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                      />
                    </td>
                    <td className="materials-table__readonly">
                      {row.unit_price_internal !== "" && row.unit_price_internal != null ? formatMXN(row.unit_price_internal) : "—"}
                    </td>
                    <td className="materials-table__readonly">
                      {row.unit_price_external !== "" && row.unit_price_external != null ? formatMXN(row.unit_price_external) : "—"}
                    </td>
                    <td>{totalInternal != null ? formatMXN(totalInternal) : "—"}</td>
                    <td>{totalExternal != null ? formatMXN(totalExternal) : "—"}</td>
                    <td className={savings != null ? "materials-table__savings-cell" : undefined}>
                      {savings != null ? formatMXN(savings) : "—"}
                    </td>
                    <td>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeRow(row.id)}>
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="materials-table__toolbar">
        <button type="button" className="btn btn-outline btn-sm" onClick={addRow}>
          {t("remodelCalculator.addMaterial")}
        </button>
        <Link to="/admin/materiales" className="form-hint">
          {t("remodelCalculator.manageCatalog")}
        </Link>
      </div>

      {hasAnyPrice && (
        <div className="materials-table__summary">
          <div className="materials-table__summary-item">
            <span className="materials-table__summary-label">{t("remodelCalculator.grandTotalInternal")}</span>
            <span className="materials-table__summary-value">{formatMXN(grandTotalInternal)}</span>
          </div>
          <div className="materials-table__summary-item">
            <span className="materials-table__summary-label">{t("remodelCalculator.grandTotalExternal")}</span>
            <span className="materials-table__summary-value">{formatMXN(grandTotalExternal)}</span>
          </div>
          <div className="materials-table__summary-item materials-table__summary-item--savings">
            <span className="materials-table__summary-label">{t("remodelCalculator.totalSavings")}</span>
            <span className="materials-table__summary-value">{formatMXN(totalSavings)}</span>
          </div>
          <p className="form-hint materials-table__disclaimer">{t("remodelCalculator.disclaimer")}</p>
        </div>
      )}
    </div>
  );
}
