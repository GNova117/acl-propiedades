import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { isBackupStale } from "../../lib/backup";
import PendingToday from "../../components/PendingToday";
import "./admin.css";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { sections, hasSection, advisorId, session } = useAuth();
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [remodelProjects, setRemodelProjects] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [citas, setCitas] = useState([]);
  const [analytics, setAnalytics] = useState({ loading: true, data: null });
  const [myVentas, setMyVentas] = useState([]);
  const [ventaProperties, setVentaProperties] = useState([]);

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

  // "Mis ventas": solo para un login vinculado a un asesor (advisorId), sin
  // pedir ningún apartado — ver las propias ventas no debería depender de
  // 'reportes' (cifras de todo el equipo) ni de 'liquidaciones' (margen de
  // la oficina). RLS en Supabase ya filtra a solo-las-propias para este
  // tipo de login (ver schema.sql, política "Asesor ve sus propias
  // ventas"); en modo demo (sin RLS real) se filtra aquí mismo con el
  // mismo criterio para que el comportamiento sea idéntico. `properties`
  // se trae aparte de la del bloque de arriba (gateada por 'propiedades')
  // porque un asesor puede no tener ese apartado y aun así necesitar los
  // títulos/precios de sus propias casas vendidas.
  useEffect(() => {
    if (advisorId == null) {
      setMyVentas([]);
      return;
    }
    Promise.all([db.getVentas(), db.getProperties({})])
      .then(([ventas, props]) => {
        setMyVentas(ventas.filter((v) => v.advisor_id === advisorId));
        setVentaProperties(props);
      })
      .catch(() => {
        setMyVentas([]);
        setVentaProperties([]);
      });
  }, [advisorId]);

  // No hay sección propia para esto (es tráfico agregado del sitio, no
  // dato de cliente ni financiero) — se muestra a cualquiera que llegue
  // al Dashboard, igual que este ya se ve completo sin RequireSection. En
  // modo demo no hay access_token real, así que simplemente no se llama
  // al endpoint (tampoco habría a qué Vercel Function pegarle).
  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setAnalytics({ loading: false, data: null });
      return;
    }
    fetch("/api/analytics-summary", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAnalytics({ loading: false, data }))
      .catch(() => setAnalytics({ loading: false, data: null }));
  }, [session]);

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

  const ventaProperty = (id) => ventaProperties.find((p) => p.id === id);

  const myVentasStats = useMemo(() => {
    const year = new Date().getFullYear();
    const thisYear = myVentas.filter((v) => v.fecha_venta?.slice(0, 4) === String(year));
    const volume = thisYear.reduce((sum, v) => sum + (ventaProperty(v.property_id)?.price || 0), 0);
    const recent = myVentas
      .slice()
      .sort((a, b) => (b.fecha_venta || "").localeCompare(a.fecha_venta || ""))
      .slice(0, 5);
    return { count: thisYear.length, volume, recent, year };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myVentas, ventaProperties]);

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "—";
  const clientName = (id) => (id ? clients.find((c) => c.id === id)?.name : null) || t("agenda.noClient");

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.dashboard")}</h1>
      </div>

      {hasSection("roles") && isBackupStale() && (
        <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <strong>{t("backup.reminderTitle")}</strong>{" "}
          <span className="form-hint">{t("backup.reminderText", { days: 7 })}</span>{" "}
          <Link to="/admin/roles">{t("backup.reminderLink")}</Link>
        </div>
      )}

      <PendingToday />

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

      {(hasSection("agenda") || hasSection("propiedades") || analytics.data || advisorId != null) && (
        <div className="admin-dashboard-panels">
          {advisorId != null && (
            <div className="card admin-dashboard-panel">
              <div className="admin-dashboard-panel__header">
                <h2>{t("admin.myVentasTitle")}</h2>
              </div>
              <div className="admin-dashboard-panel__analytics-totals">
                <div>
                  <span className="admin-stat-card__value">{myVentasStats.count}</span>
                  <span className="admin-stat-card__label">{t("admin.myVentasCount", { year: myVentasStats.year })}</span>
                </div>
                <div>
                  <span className="admin-stat-card__value">{formatMXN(myVentasStats.volume)}</span>
                  <span className="admin-stat-card__label">{t("admin.myVentasVolume")}</span>
                </div>
              </div>
              {myVentasStats.recent.length === 0 ? (
                <p className="form-hint">{t("admin.myVentasEmpty")}</p>
              ) : (
                <div className="admin-dashboard-panel__list">
                  {myVentasStats.recent.map((v) => {
                    const property = ventaProperty(v.property_id);
                    return (
                      <div key={v.id} className="admin-dashboard-panel__row">
                        <span>{property?.title || "—"}</span>
                        <span className="admin-dashboard-panel__row-meta">{property ? formatMXN(property.price) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {analytics.data && (
            <div className="card admin-dashboard-panel">
              <div className="admin-dashboard-panel__header">
                <h2>{t("admin.analyticsTitle")}</h2>
              </div>
              {analytics.data.configured === false ? (
                <p className="form-hint">{t("admin.analyticsNotConfigured")}</p>
              ) : (
                <>
                  <div className="admin-dashboard-panel__analytics-totals">
                    <div>
                      <span className="admin-stat-card__value">{analytics.data.activeUsers}</span>
                      <span className="admin-stat-card__label">{t("admin.analyticsUsers")}</span>
                    </div>
                    <div>
                      <span className="admin-stat-card__value">{analytics.data.pageViews}</span>
                      <span className="admin-stat-card__label">{t("admin.analyticsPageViews")}</span>
                    </div>
                  </div>
                  {analytics.data.topPages?.length > 0 && (
                    <div className="admin-dashboard-panel__list">
                      {analytics.data.topPages.map((page) => (
                        <div key={page.title} className="admin-dashboard-panel__row">
                          <span>{page.title}</span>
                          <span className="admin-dashboard-panel__row-meta">{page.views}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
