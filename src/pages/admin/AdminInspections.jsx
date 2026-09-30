import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { buildInspectionLabels, downloadInspectionPdf } from "../../lib/inspectionPdf";
import "./admin.css";
import "./AdminInspections.css";

const STATUS_KEY = { verde: "green", amarillo: "yellow", rojo: "red" };

export default function AdminInspections() {
  const { t, i18n } = useTranslation();
  const [inspections, setInspections] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyPdfId, setBusyPdfId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([db.getInspections(), db.getProperties({})])
      .then(([inspectionData, propertyData]) => {
        setInspections(inspectionData);
        setProperties(propertyData);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message || "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const visible = useMemo(() => inspections.filter((i) => !statusFilter || i.estatus === statusFilter), [inspections, statusFilter]);

  const formatDateTime = (iso) =>
    new Date(iso).toLocaleString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" });

  const handleDelete = async (inspection) => {
    if (!window.confirm(t("inspections.confirmDelete"))) return;
    try {
      await db.deleteInspection(inspection.id);
      load();
    } catch (err) {
      window.alert(err.message || t("inspections.form.saveError"));
    }
  };

  const handleDownloadPdf = async (inspection) => {
    setBusyPdfId(inspection.id);
    try {
      const fresh = await db.getInspectionById(inspection.id);
      await downloadInspectionPdf(fresh, buildInspectionLabels(t, i18n, fresh));
    } catch (err) {
      window.alert(err.message || t("inspections.form.pdfError"));
    } finally {
      setBusyPdfId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("inspections.title")}</h1>
        <div className="admin-header__actions">
          <Link to="/admin/inspecciones/nueva" className="btn btn-primary">
            {t("inspections.newInspection")}
          </Link>
        </div>
      </div>

      {loadError && <p className="form-error">{t("inspections.loadError", { error: loadError })}</p>}

      <div className="inspections-filters">
        <div className="form-field">
          <label htmlFor="insp-status-filter">{t("inspections.table.status")}</label>
          <select id="insp-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("inspections.filters.allStatuses")}</option>
            <option value="verde">{t("inspections.status.green")}</option>
            <option value="amarillo">{t("inspections.status.yellow")}</option>
            <option value="rojo">{t("inspections.status.red")}</option>
          </select>
        </div>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("inspections.table.folio")}</th>
              <th>{t("inspections.table.address")}</th>
              <th>{t("inspections.table.property")}</th>
              <th>{t("inspections.table.inspector")}</th>
              <th>{t("inspections.table.when")}</th>
              <th>{t("inspections.table.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>{t("common.loading")}</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={7}>{inspections.length === 0 ? t("inspections.empty") : t("inspections.noMatches")}</td>
              </tr>
            ) : (
              visible.map((inspection) => (
                <tr key={inspection.id}>
                  <td>{inspection.folio}</td>
                  <td>{inspection.direccion}</td>
                  <td>{propertyById.get(inspection.property_id)?.title || "—"}</td>
                  <td>{inspection.inspector}</td>
                  <td>{formatDateTime(inspection.visited_at)}</td>
                  <td>
                    <span className={`inspection-badge inspection-badge--${STATUS_KEY[inspection.estatus]}`}>
                      {t(`inspections.status.${STATUS_KEY[inspection.estatus]}`)}
                    </span>
                  </td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/inspecciones/${inspection.id}`} state={{ from: "/admin/inspecciones" }} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDownloadPdf(inspection)} disabled={busyPdfId === inspection.id}>
                      {busyPdfId === inspection.id ? <span className="spinner" /> : null}
                      PDF
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(inspection)}>
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
