import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import "./admin.css";

export default function AdminZones() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const load = () => {
    db.getZones().then((data) => {
      setZones(data);
      setDrafts(Object.fromEntries(data.map((z) => [z.id, z.price_per_m2])));
    });
  };

  useEffect(load, []);

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

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.zones")}</h1>
      </div>

      <div className="admin-zones-grid">
        {zones.map((zone) => (
          <div key={zone.id} className="card admin-zone-card">
            <h3>{zone.name}</h3>
            <p className="form-hint">{t("calculator.pricePerM2")}: {formatMXN(zone.price_per_m2)}</p>
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
          </div>
        ))}
      </div>
    </div>
  );
}
