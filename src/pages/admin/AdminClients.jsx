import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

export default function AdminClients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    db.getClients(typeFilter ? { type: typeFilter } : {}).then((data) => {
      setClients(data);
      setLoading(false);
    });
  };

  useEffect(load, [typeFilter]);

  const months = t("dateFilter.months", { returnObjects: true });

  const years = useMemo(() => {
    const set = new Set(clients.filter((c) => c.created_at).map((c) => new Date(c.created_at).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!monthFilter && !yearFilter) return clients;
    return clients.filter((c) => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      if (monthFilter && d.getMonth() + 1 !== Number(monthFilter)) return false;
      if (yearFilter && d.getFullYear() !== Number(yearFilter)) return false;
      return true;
    });
  }, [clients, monthFilter, yearFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteClient(id);
    load();
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("clients.title")}</h1>
        <Link to="/admin/clientes/nuevo" className="btn btn-primary">
          {t("admin.newClient")}
        </Link>
      </div>

      <div className="form-row" style={{ maxWidth: 620, marginBottom: "1.25rem" }}>
        <div className="form-field">
          <label htmlFor="client-type-filter">{t("clients.type")}</label>
          <select id="client-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">—</option>
            <option value="comprador">{t("clients.buyer")}</option>
            <option value="vendedor">{t("clients.seller")}</option>
            <option value="ambos">{t("clients.both")}</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="client-month-filter">{t("dateFilter.month")}</label>
          <select id="client-month-filter" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">{t("dateFilter.allMonths")}</option>
            {months.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="client-year-filter">{t("dateFilter.year")}</label>
          <select id="client-year-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">{t("dateFilter.allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("clients.name")}</th>
              <th>{t("clients.type")}</th>
              <th>{t("clients.phone")}</th>
              <th>{t("clients.email")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>{t("common.loading")}</td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={5}>{t("clients.noResults")}</td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{t(`clients.${client.type === "comprador" ? "buyer" : client.type === "vendedor" ? "seller" : "both"}`)}</td>
                  <td>{client.phone}</td>
                  <td>{client.email}</td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/clientes/${client.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <Link to={`/admin/clientes/${client.id}/perfilamiento`} className="btn btn-outline btn-sm">
                      {t("profiling.title")}
                    </Link>
                    <Link to={`/admin/clientes/${client.id}/documentos`} className="btn btn-outline btn-sm">
                      {t("clients.viewDocuments")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(client.id)}>
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
