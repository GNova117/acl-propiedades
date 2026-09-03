import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import "./admin.css";

export default function AdminZones() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [properties, setProperties] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    Promise.all([db.getZones(), db.getProperties({})]).then(([zoneData, propertyData]) => {
      setZones(zoneData);
      setProperties(propertyData);
      setDrafts(Object.fromEntries(zoneData.map((z) => [z.id, z.price_per_m2])));
    });
  };

  useEffect(load, []);

  const propertyCountByZone = (zoneName) => properties.filter((p) => p.zone === zoneName).length;

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
    </div>
  );
}
