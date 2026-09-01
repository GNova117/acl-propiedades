import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

export default function AdminClients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    db.getClients(typeFilter ? { type: typeFilter } : {}).then((data) => {
      setClients(data);
      setLoading(false);
    });
  };

  useEffect(load, [typeFilter]);

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

      <div className="form-field" style={{ maxWidth: 240, marginBottom: "1.25rem" }}>
        <label htmlFor="client-type-filter">{t("clients.type")}</label>
        <select id="client-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">—</option>
          <option value="comprador">{t("clients.buyer")}</option>
          <option value="vendedor">{t("clients.seller")}</option>
          <option value="ambos">{t("clients.both")}</option>
        </select>
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
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={5}>{t("clients.noResults")}</td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{t(`clients.${client.type === "comprador" ? "buyer" : client.type === "vendedor" ? "seller" : "both"}`)}</td>
                  <td>{client.phone}</td>
                  <td>{client.email}</td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/clientes/${client.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
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
