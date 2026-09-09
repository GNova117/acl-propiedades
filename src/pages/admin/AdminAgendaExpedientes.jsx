import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

export default function AdminAgendaExpedientes() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [cita, setCita] = useState(null);
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([db.getAgendaCitaById(id), db.getAgendaExpedientes(id)]).then(([citaData, expedientesData]) => {
      setCita(citaData);
      setExpedientes(expedientesData);
      setLoading(false);
    });
  };

  useEffect(load, [id]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await db.addAgendaExpediente({ cita_id: id, file });
      load();
    } catch (err) {
      window.alert(err.message || "Error al subir el expediente");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (expedienteId) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingId(expedienteId);
    try {
      await db.deleteAgendaExpediente(expedienteId);
      load();
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("agenda.expedientes")}</h1>
          <p className="form-hint">{cita?.titulo}</p>
        </div>
        <Link to="/admin/agenda" className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        {expedientes.length === 0 ? (
          <p className="form-hint">{t("agenda.noFiles")}</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("agenda.fileName")}</th>
                  <th>{t("agenda.uploadedAt")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {expedientes.map((expediente) => (
                  <tr key={expediente.id}>
                    <td>
                      <a href={expediente.signed_url} target="_blank" rel="noreferrer">
                        {expediente.file_name || expediente.file_path}
                      </a>
                    </td>
                    <td>{new Date(expediente.created_at).toLocaleString()}</td>
                    <td className="admin-table__actions">
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(expediente.id)}
                        disabled={deletingId === expediente.id}
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="btn btn-primary btn-sm" style={{ marginTop: "1rem", cursor: "pointer", display: "inline-block" }}>
          {uploading ? <span className="spinner" /> : null}
          {t("agenda.addFile")}
          <input type="file" onChange={handleFileSelect} disabled={uploading} hidden />
        </label>
      </div>
    </div>
  );
}
