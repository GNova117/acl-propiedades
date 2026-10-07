import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import { whatsappDigits } from "../../lib/format";
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
  // Recordatorio manual por WhatsApp al cliente (funciona sin esperar el aviso automático).
  const remind = (cita) => {
    const client = clients.find((c) => c.id === cita.client_id);
    let digits = whatsappDigits(client?.phone);
    if (digits.length === 10) digits = `52${digits}`;
    const date = new Date(`${cita.fecha}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    const when = cita.hora ? `${date} a las ${cita.hora.slice(0, 5)}` : date;
    const text = t("agenda.reminderText", { name: (client?.name || "").split(/\s+/)[0], title: cita.titulo, when, advisor: advisorName(cita.advisor_id) });
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const clientName = (id) => (id ? clients.find((c) => c.id === id)?.name : null) || t("agenda.noClient");

  // Cambio rápido de estatus desde la lista. Al cancelar se pide el motivo
  // (opcional, se puede dejar en blanco) para no perder el rastro de qué pasó.
  const handleStatusChange = async (cita, status) => {
    const nota = status === "cancelada" ? window.prompt(t("agenda.cancelReasonPrompt")) : null;
    if (status === "cancelada" && nota === null) return; // canceló el prompt, no el estatus
    await db.updateAgendaCitaStatus(cita.id, status, nota ? `${t("agenda.cancelledNotePrefix")} ${nota.trim()}` : null);
    load();
  };

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
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={seesAll ? 6 : 5}>{t("common.loading")}</td>
              </tr>
            ) : visibleCitas.length === 0 ? (
              <tr>
                <td colSpan={seesAll ? 6 : 5}>{t("agenda.noAppointments")}</td>
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
                  <td>
                    <select
                      className={`agenda-status agenda-status--${cita.status || "pendiente"}`}
                      value={cita.status || "pendiente"}
                      onChange={(e) => handleStatusChange(cita, e.target.value)}
                    >
                      <option value="pendiente">{t("agenda.status.pendiente")}</option>
                      <option value="confirmada">{t("agenda.status.confirmada")}</option>
                      <option value="realizada">{t("agenda.status.realizada")}</option>
                      <option value="cancelada">{t("agenda.status.cancelada")}</option>
                    </select>
                  </td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/agenda/${cita.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <Link to={`/admin/agenda/${cita.id}/expedientes`} className="btn btn-outline btn-sm">
                      {t("agenda.expedientes")}
                    </Link>
                    {clients.find((c) => c.id === cita.client_id)?.phone && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => remind(cita)}>
                        {t("agenda.remindClient")}
                      </button>
                    )}
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
