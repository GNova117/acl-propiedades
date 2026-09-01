import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import "./admin.css";

export default function AdminMaterialsCatalog() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    db.getMaterialsCatalog().then((data) => {
      setItems(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteMaterialCatalogItem(id);
    load();
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("materialsCatalog.title")}</h1>
        <Link to="/admin/materiales/nuevo" className="btn btn-primary">
          {t("admin.newMaterialCatalogItem")}
        </Link>
      </div>

      <p className="form-hint" style={{ marginBottom: "1.25rem" }}>
        {t("materialsCatalog.subtitle")}
      </p>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("materialsCatalog.name")}</th>
              <th>{t("remodelCalculator.category")}</th>
              <th>{t("remodelCalculator.unit")}</th>
              <th>{t("remodelCalculator.unitPriceInternal")}</th>
              <th>{t("remodelCalculator.unitPriceExternal")}</th>
              <th>{t("materialsCatalog.consumptionRate")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>{t("common.loading")}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8}>{t("materialsCatalog.noResults")}</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td>{item.unit_price_internal != null ? formatMXN(item.unit_price_internal) : "—"}</td>
                  <td>{item.unit_price_external != null ? formatMXN(item.unit_price_external) : "—"}</td>
                  <td>
                    {item.consumption_rate != null && item.consumption_basis
                      ? `${item.consumption_rate} / ${t(`materialsCatalog.consumptionBasisOptions.${item.consumption_basis}`)}`
                      : "—"}
                  </td>
                  <td>
                    <span className={`badge ${item.active !== false ? "badge-available" : "badge-sold"}`}>
                      {item.active !== false ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/materiales/${item.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
