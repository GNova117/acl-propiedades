import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../../lib/format";
import "./admin.css";

export default function AdminZones() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState(null);

  const load = () => {
    Promise.all([db.getZones(), db.getProperties({}), db.getPropertyTypes()]).then(([zoneData, propertyData, typeData]) => {
      setZones(zoneData);
      setProperties(propertyData);
      setPropertyTypes(typeData);
      setDrafts(Object.fromEntries(zoneData.map((z) => [z.id, z.price_per_m2])));
    });
  };

  useEffect(load, []);

  const propertyCountByZone = (zoneName) => properties.filter((p) => p.zone === zoneName).length;
  const propertyCountByType = (typeKey) => properties.filter((p) => p.type === typeKey).length;

  const handleSave = async (zone) => {
    setSavingId(zone.id);
    try {
      await db.updateZonePrice(zone.id, drafts[zone.id]);
      setSavedId(zone.id);
      setTimeout(() => setSavedId(null), 1500);
      load();
    } finally {
      setSavingId(null);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await db.addZone({ name: newName, price_per_m2: newPrice });
      setNewName("");
      setNewPrice("");
      load();
    } catch (err) {
      window.alert(err.message || "Error al agregar la zona");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (zone) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingId(zone.id);
    try {
      await db.deleteZone(zone.id);
      load();
    } catch (err) {
      window.alert(err.message || "Error al eliminar la zona");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newTypeLabel.trim()) return;
    setAddingType(true);
    try {
      await db.addPropertyType({ label: newTypeLabel });
      setNewTypeLabel("");
      load();
    } catch (err) {
      window.alert(err.message || "Error al agregar el tipo de propiedad");
    } finally {
      setAddingType(false);
    }
  };

  const handleDeleteType = async (type) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingTypeId(type.id);
    try {
      await db.deletePropertyType(type.id);
      load();
    } catch (err) {
      window.alert(err.message || "Error al eliminar el tipo de propiedad");
    } finally {
      setDeletingTypeId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.zones")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleAdd} style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("admin.newZone")}</h2>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="zone-new-name">{t("zones.name")}</label>
            <input id="zone-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Matamoros" />
          </div>
          <div className="form-field">
            <label htmlFor="zone-new-price">{t("calculator.pricePerM2")}</label>
            <input id="zone-new-price" type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          </div>
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={adding || !newName.trim()}>
            {adding ? <span className="spinner" /> : null}
            {t("zones.add")}
          </button>
        </div>
      </form>

      <div className="admin-zones-grid">
        {zones.map((zone) => {
          const inUse = propertyCountByZone(zone.name);
          return (
            <div key={zone.id} className="card admin-zone-card">
              <h3>{zone.name}</h3>
              <p className="form-hint">{t("calculator.pricePerM2")}: {formatMXN(zone.price_per_m2)}</p>
              <p className="form-hint">{t(inUse === 1 ? "zones.inUse_one" : "zones.inUse_other", { count: inUse })}</p>
              <div className="admin-zone-card__row">
                <input
                  type="number"
                  min="0"
                  value={drafts[zone.id] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [zone.id]: e.target.value }))}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSave(zone)} disabled={savingId === zone.id}>
                  {savedId === zone.id ? "✓" : t("common.save")}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ marginTop: "0.6rem" }}
                onClick={() => handleDelete(zone)}
                disabled={inUse > 0 || deletingId === zone.id}
                title={inUse > 0 ? t("zones.cannotDelete") : undefined}
              >
                {t("common.delete")}
              </button>
            </div>
          );
        })}
      </div>

      <div className="admin-header" style={{ marginTop: "2.5rem" }}>
        <h1>{t("admin.propertyTypes")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleAddType} style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("admin.newPropertyType")}</h2>
        <div className="form-field">
          <label htmlFor="type-new-name">{t("propertyTypesModule.name")}</label>
          <input id="type-new-name" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} placeholder="Bodega" />
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={addingType || !newTypeLabel.trim()}>
            {addingType ? <span className="spinner" /> : null}
            {t("propertyTypesModule.add")}
          </button>
        </div>
      </form>

      <div className="admin-zones-grid">
        {propertyTypes.map((type) => {
          const inUse = propertyCountByType(type.key);
          return (
            <div key={type.id} className="card admin-zone-card">
              <h3>{propertyTypeLabel(t, type.key)}</h3>
              <p className="form-hint">{t(inUse === 1 ? "propertyTypesModule.inUse_one" : "propertyTypesModule.inUse_other", { count: inUse })}</p>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteType(type)}
                disabled={inUse > 0 || deletingTypeId === type.id}
                title={inUse > 0 ? t("propertyTypesModule.cannotDelete") : undefined}
              >
                {t("common.delete")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
