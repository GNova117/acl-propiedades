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
  const [laborItems, setLaborItems] = useState([]);
  const [laborDrafts, setLaborDrafts] = useState({});
  const [savingLaborId, setSavingLaborId] = useState(null);
  const [savedLaborId, setSavedLaborId] = useState(null);
  const [deletingLaborId, setDeletingLaborId] = useState(null);
  const [newLaborConcepto, setNewLaborConcepto] = useState("");
  const [newLaborUnidad, setNewLaborUnidad] = useState("");
  const [newLaborPrecio, setNewLaborPrecio] = useState("");
  const [addingLabor, setAddingLabor] = useState(false);

  const load = () => {
    setLoading(true);
    db.getMaterialsCatalog().then((data) => {
      setItems(data);
      setLoading(false);
    });
    db.getLaborCatalog().then((data) => {
      setLaborItems(data);
      setLaborDrafts(Object.fromEntries(data.map((item) => [item.id, item.precio_unitario ?? ""])));
    });
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteMaterialCatalogItem(id);
    load();
  };

  const handleAddLabor = async (e) => {
    e.preventDefault();
    if (!newLaborConcepto.trim()) return;
    setAddingLabor(true);
    try {
      await db.addLaborCatalogItem({ concepto: newLaborConcepto, unidad: newLaborUnidad, precio_unitario: newLaborPrecio });
      setNewLaborConcepto("");
      setNewLaborUnidad("");
      setNewLaborPrecio("");
      load();
    } catch (err) {
      window.alert(err.message || "Error al agregar el concepto de mano de obra");
    } finally {
      setAddingLabor(false);
    }
  };

  const handleSaveLaborPrice = async (item) => {
    setSavingLaborId(item.id);
    try {
      await db.updateLaborPrice(item.id, laborDrafts[item.id]);
      setSavedLaborId(item.id);
      setTimeout(() => setSavedLaborId(null), 1500);
      load();
    } finally {
      setSavingLaborId(null);
    }
  };

  const handleDeleteLabor = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingLaborId(id);
    try {
      await db.deleteLaborCatalogItem(id);
      load();
    } finally {
      setDeletingLaborId(null);
    }
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

      <div className="admin-header" style={{ marginTop: "2.5rem" }}>
        <h1>{t("laborCatalog.title")}</h1>
      </div>
      <p className="form-hint" style={{ marginBottom: "1.25rem" }}>{t("laborCatalog.subtitle")}</p>

      <form className="card admin-form" onSubmit={handleAddLabor} style={{ maxWidth: 640, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("laborCatalog.new")}</h2>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="labor-new-concepto">{t("laborCatalog.concepto")}</label>
            <input id="labor-new-concepto" value={newLaborConcepto} onChange={(e) => setNewLaborConcepto(e.target.value)} placeholder="Instalación de piso laminado" />
          </div>
          <div className="form-field">
            <label htmlFor="labor-new-unidad">{t("laborCatalog.unidad")}</label>
            <input id="labor-new-unidad" value={newLaborUnidad} onChange={(e) => setNewLaborUnidad(e.target.value)} placeholder="m², ml, pieza..." />
          </div>
          <div className="form-field">
            <label htmlFor="labor-new-precio">{t("laborCatalog.precioUnitario")}</label>
            <input id="labor-new-precio" type="number" min="0" value={newLaborPrecio} onChange={(e) => setNewLaborPrecio(e.target.value)} />
          </div>
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={addingLabor || !newLaborConcepto.trim()}>
            {addingLabor ? <span className="spinner" /> : null}
            {t("laborCatalog.add")}
          </button>
        </div>
      </form>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("laborCatalog.concepto")}</th>
              <th>{t("laborCatalog.unidad")}</th>
              <th>{t("laborCatalog.precioUnitario")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {laborItems.length === 0 ? (
              <tr>
                <td colSpan={4}>{t("laborCatalog.noResults")}</td>
              </tr>
            ) : (
              laborItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.concepto}</td>
                  <td>{item.unidad || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="number"
                        min="0"
                        value={laborDrafts[item.id] ?? ""}
                        onChange={(e) => setLaborDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        style={{ width: "110px" }}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveLaborPrice(item)} disabled={savingLaborId === item.id}>
                        {savedLaborId === item.id ? "✓" : t("common.save")}
                      </button>
                    </div>
                  </td>
                  <td className="admin-table__actions">
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteLabor(item.id)} disabled={deletingLaborId === item.id}>
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
