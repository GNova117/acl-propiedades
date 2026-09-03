import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { propertyTypeLabel } from "../../lib/format";
import "./admin.css";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [remodelProjects, setRemodelProjects] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);

  useEffect(() => {
    db.getProperties({}).then(setProperties);
    db.getAdvisors().then(setAdvisors);
    db.getClients().then(setClients);
    db.getRemodelProjects().then(setRemodelProjects);
    db.getPropertyTypes().then(setPropertyTypes);
  }, []);

  const byType = propertyTypes.map((pt) => ({
    type: pt.key,
    count: properties.filter((p) => p.type === pt.key).length,
  }));

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.dashboard")}</h1>
      </div>

      <div className="admin-stats">
        <div className="card admin-stat-card">
          <span className="admin-stat-card__value">{properties.length}</span>
          <span className="admin-stat-card__label">{t("admin.totalProperties")}</span>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-card__value">{advisors.filter((a) => a.active !== false).length}</span>
          <span className="admin-stat-card__label">{t("admin.activeAdvisors")}</span>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-card__value">{clients.length}</span>
          <span className="admin-stat-card__label">{t("clients.title")}</span>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-card__value">{remodelProjects.length}</span>
          <span className="admin-stat-card__label">{t("admin.remodelProjects")}</span>
        </div>
        {byType.map(({ type, count }) => (
          <div className="card admin-stat-card" key={type}>
            <span className="admin-stat-card__value">{count}</span>
            <span className="admin-stat-card__label">{propertyTypeLabel(t, type)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
