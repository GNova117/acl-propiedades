import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { sections, hasSection, advisorId } = useAuth();
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [remodelProjects, setRemodelProjects] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [citas, setCitas] = useState([]);

  const sectionsKey = sections.join(",");
  const seesAllAgendas = advisorId == null;

  useEffect(() => {
    if (hasSection("propiedades")) {
      db.getProperties({}).then(setProperties);
      db.getPropertyTypes().then(setPropertyTypes);
    }
    if (hasSection("asesores") || hasSection("agenda")) db.getAdvisors().then(setAdvisors);
    if (hasSection("clientes") || hasSection("agenda")) db.getClients().then(setClients);
    if (hasSection("remodelaciones")) db.getRemodelProjects().then(setRemodelProjects);
    if (hasSection("mensajes")) db.getContactMessages().then(setMessages);
    if (hasSection("agenda")) db.getAgendaCitas().then(setCitas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsKey]);

  const byType = propertyTypes.map((pt) => ({
    type: pt.key,
    count: properties.filter((p) => p.type === pt.key).length,
  }));

  const newMessagesCount = messages.filter((m) => (m.status || "nuevo") === "nuevo").length;

  const todayCitas = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return citas
      .filter((c) => c.fecha === today)
      .slice()
      .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  }, [citas]);

  const recentProperties = useMemo(() => {
    return properties
      .filter((p) => p.created_at)
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  }, [properties]);

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "—";
  const clientName = (id) => (id ? clients.find((c) => c.id === id)?.name : null) || t("agenda.noClient");

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
        {hasSection("mensajes") && (
          <Link to="/admin/mensajes" className="card admin-stat-card">
            <span className="admin-stat-card__value">{newMessagesCount}</span>
            <span className="admin-stat-card__label">{t("admin.newMessages")}</span>
          </Link>
        )}
        {hasSection("propiedades") &&
          byType.map(({ type, count }) => (
            <div className="card admin-stat-card" key={type}>
              <span className="admin-stat-card__value">{count}</span>
              <span className="admin-stat-card__label">{propertyTypeLabel(t, type)}</span>
            </div>
          ))}
      </div>

      {(hasSection("agenda") || hasSection("propiedades")) && (
        <div className="admin-dashboard-panels">
          {hasSection("agenda") && (
            <div className="card admin-dashboard-panel">
              <div className="admin-dashboard-panel__header">
                <h2>{t("admin.todayAppointments")}</h2>
                <Link to="/admin/agenda" className="btn btn-outline btn-sm">
                  {t("admin.viewAll")}
                </Link>
              </div>
              {todayCitas.length === 0 ? (
                <p className="form-hint">{t("admin.noAppointmentsToday")}</p>
              ) : (
                <div className="admin-dashboard-panel__list">
                  {todayCitas.map((cita) => (
                    <Link key={cita.id} to={`/admin/agenda/${cita.id}`} className="admin-dashboard-panel__row">
                      <span>
                        {cita.titulo}
                        <span className="admin-dashboard-panel__row-meta">
                          {" · "}
                          {clientName(cita.client_id)}
                          {seesAllAgendas ? ` · ${advisorName(cita.advisor_id)}` : ""}
                        </span>
                      </span>
                      <span className="admin-dashboard-panel__row-meta">{cita.hora ? cita.hora.slice(0, 5) : "—"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasSection("propiedades") && (
            <div className="card admin-dashboard-panel">
              <div className="admin-dashboard-panel__header">
                <h2>{t("admin.recentProperties")}</h2>
                <Link to="/admin/propiedades" className="btn btn-outline btn-sm">
                  {t("admin.viewAll")}
                </Link>
              </div>
              {recentProperties.length === 0 ? (
                <p className="form-hint">{t("properties.noResults")}</p>
              ) : (
                <div className="admin-dashboard-panel__list">
                  {recentProperties.map((property) => (
                    <div key={property.id} className="admin-dashboard-panel__row">
                      <span>
                        {property.title}
                        <span className="admin-dashboard-panel__row-meta">
                          {" · "}
                          {property.zone}
                        </span>
                      </span>
                      <span className="admin-dashboard-panel__row-meta">{formatMXN(property.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
