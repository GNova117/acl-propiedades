import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

// advisorId es null tanto en modo demo como para cualquier correo sin
// asesor vinculado desde /admin/roles — en ambos casos se ven TODAS las
// citas (RLS ya filtra del lado de Supabase; aquí solo se agrega el
// selector de asesor para poder acotar la vista).
export default function AdminAgenda() {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const [citas, setCitas] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advisorFilter, setAdvisorFilter] = useState("");

  const seesAll = advisorId == null;

  const load = () => {
    setLoading(true);
    Promise.all([db.getAgendaCitas(), db.getAdvisors(), db.getClients()]).then(([citasData, advisorData, clientData]) => {
      setCitas(citasData);
      setAdvisors(advisorData);
      setClients(clientData);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteAgendaCita(id);
    load();
  };

  const advisorName = (id) => advisors.find((a) => a.id === id)?.name || "—";
  const clientName = (id) => (id ? clients.find((c) => c.id === id)?.name : null) || t("agenda.noClient");

  const visibleCitas = useMemo(() => {
    if (!seesAll || !advisorFilter) return citas;
    return citas.filter((c) => c.advisor_id === advisorFilter);
  }, [citas, seesAll, advisorFilter]);

  return (
    <div>
      <div className="admin-header">
        <h1>{seesAll ? t("agenda.allAgendas") : t("agenda.myAgenda")}</h1>
        <Link to="/admin/agenda/nueva" className="btn btn-primary">
          {t("agenda.newAppointment")}
        </Link>
      </div>

      {seesAll && (
        <div className="form-field" style={{ maxWidth: 320, marginBottom: "1.25rem" }}>
          <label htmlFor="agenda-advisor-filter">{t("agenda.advisorFilter")}</label>
          <select id="agenda-advisor-filter" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
            <option value="">{t("agenda.allAdvisorsOption")}</option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("agenda.date")}</th>
              <th>{t("agenda.titleField")}</th>
              {seesAll && <th>{t("agenda.advisor")}</th>}
              <th>{t("agenda.client")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={seesAll ? 5 : 4}>{t("common.loading")}</td>
              </tr>
            ) : visibleCitas.length === 0 ? (
              <tr>
                <td colSpan={seesAll ? 5 : 4}>{t("agenda.noAppointments")}</td>
              </tr>
            ) : (
              visibleCitas.map((cita) => (
                <tr key={cita.id}>
                  <td>
                    {new Date(`${cita.fecha}T00:00:00`).toLocaleDateString()}
                    {cita.hora ? ` · ${cita.hora.slice(0, 5)}` : ""}
                  </td>
                  <td>{cita.titulo}</td>
                  {seesAll && <td>{advisorName(cita.advisor_id)}</td>}
                  <td>{clientName(cita.client_id)}</td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/agenda/${cita.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <Link to={`/admin/agenda/${cita.id}/expedientes`} className="btn btn-outline btn-sm">
                      {t("agenda.expedientes")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(cita.id)}>
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
