import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatArea } from "../../lib/format";
import "./admin.css";

export default function AdminRemodelProjects() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([db.getRemodelProjects(), db.getClients()]).then(([projectData, clientData]) => {
      setProjects(projectData);
      setClients(clientData);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteRemodelProject(id);
    load();
  };

  const clientName = (clientId) => clients.find((c) => c.id === clientId)?.name || t("remodelCalculator.noClient");

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.remodelProjects")}</h1>
        <Link to="/admin/remodelaciones/nuevo" className="btn btn-primary">
          {t("admin.newRemodelProject")}
        </Link>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("remodelCalculator.projectName")}</th>
              <th>{t("remodelCalculator.client")}</th>
              <th>{t("remodelCalculator.area")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>{t("common.loading")}</td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={4}>{t("remodelCalculator.noResults")}</td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{clientName(project.client_id)}</td>
                  <td>{formatArea(project.area_m2)}</td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/remodelaciones/${project.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(project.id)}>
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
