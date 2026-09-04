import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { propertyTypeLabel } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { sections, hasSection } = useAuth();
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [remodelProjects, setRemodelProjects] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);

  const sectionsKey = sections.join(",");

  useEffect(() => {
    if (hasSection("propiedades")) {
      db.getProperties({}).then(setProperties);
      db.getPropertyTypes().then(setPropertyTypes);
    }
    if (hasSection("asesores")) db.getAdvisors().then(setAdvisors);
    if (hasSection("clientes")) db.getClients().then(setClients);
    if (hasSection("remodelaciones")) db.getRemodelProjects().then(setRemodelProjects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsKey]);

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
        {hasSection("propiedades") && (
          <div className="card admin-stat-card">
            <span className="admin-stat-card__value">{properties.length}</span>
            <span className="admin-stat-card__label">{t("admin.totalProperties")}</span>
          </div>
        )}
        {hasSection("asesores") && (
          <div className="card admin-stat-card">
            <span className="admin-stat-card__value">{advisors.filter((a) => a.active !== false).length}</span>
            <span className="admin-stat-card__label">{t("admin.activeAdvisors")}</span>
          </div>
        )}
        {hasSection("clientes") && (
          <div className="card admin-stat-card">
            <span className="admin-stat-card__value">{clients.length}</span>
            <span className="admin-stat-card__label">{t("clients.title")}</span>
          </div>
        )}
        {hasSection("remodelaciones") && (
          <div className="card admin-stat-card">
            <span className="admin-stat-card__value">{remodelProjects.length}</span>
            <span className="admin-stat-card__label">{t("admin.remodelProjects")}</span>
          </div>
        )}
        {hasSection("propiedades") &&
          byType.map(({ type, count }) => (
            <div className="card admin-stat-card" key={type}>
              <span className="admin-stat-card__value">{count}</span>
              <span className="admin-stat-card__label">{propertyTypeLabel(t, type)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
