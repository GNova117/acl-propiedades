import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

export default function AdminAdvisors() {
  const { t } = useTranslation();
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    db.getAdvisors().then((data) => {
      setAdvisors(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteAdvisor(id);
    load();
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.advisors")}</h1>
        <Link to="/admin/asesores/nuevo" className="btn btn-primary">
          {t("admin.newAdvisor")}
        </Link>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>{t("common.loading")}</td></tr>
            ) : advisors.length === 0 ? (
              <tr><td colSpan={6}>{t("properties.noResults")}</td></tr>
            ) : (
              advisors.map((advisor) => (
                <tr key={advisor.id}>
                  <td><img src={advisor.photo_url} alt="" /></td>
                  <td>{advisor.name}</td>
                  <td>{advisor.phone}</td>
                  <td>{advisor.email}</td>
                  <td>
                    <span className={`badge ${advisor.active !== false ? "badge-available" : "badge-sold"}`}>
                      {advisor.active !== false ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/asesores/${advisor.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(advisor.id)}>
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
