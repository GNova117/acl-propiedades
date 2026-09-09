import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

const EMPTY = { advisor_id: "", client_id: "", titulo: "", fecha: "", hora: "", actividades: "" };

export default function AdminAgendaForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { advisorId } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([db.getAdvisors(), db.getClients(), isEdit ? db.getAgendaCitaById(id) : Promise.resolve(null)]).then(
      ([advisorData, clientData, cita]) => {
        setAdvisors(advisorData);
        setClients(clientData);
        if (cita) {
          setForm({
            advisor_id: cita.advisor_id,
            client_id: cita.client_id || "",
            titulo: cita.titulo,
            fecha: cita.fecha,
            hora: cita.hora ? cita.hora.slice(0, 5) : "",
            actividades: cita.actividades || "",
          });
        } else if (advisorId) {
          // Agenda propia: el asesor no elige, la cita siempre se crea para sí mismo.
          setForm((prev) => ({ ...prev, advisor_id: advisorId }));
        }
        setLoading(false);
      }
    );
  }, [id, isEdit, advisorId]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validate = () => {
    const next = {};
    if (!form.advisor_id) next.advisor_id = t("contact.required");
    if (!form.titulo.trim()) next.titulo = t("contact.required");
    if (!form.fecha) next.fecha = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await db.updateAgendaCita(id, form);
      } else {
        await db.addAgendaCita(form);
      }
      navigate("/admin/agenda");
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("agenda.editAppointment") : t("agenda.newAppointment")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        {!advisorId && (
          <div className="form-field">
            <label htmlFor="cita-advisor">{t("agenda.advisor")}</label>
            <select id="cita-advisor" value={form.advisor_id} onChange={handleChange("advisor_id")}>
              <option value="">—</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {errors.advisor_id && <span className="form-error">{errors.advisor_id}</span>}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="cita-titulo">{t("agenda.titleField")}</label>
          <input id="cita-titulo" value={form.titulo} onChange={handleChange("titulo")} />
          {errors.titulo && <span className="form-error">{errors.titulo}</span>}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="cita-fecha">{t("agenda.date")}</label>
            <input id="cita-fecha" type="date" value={form.fecha} onChange={handleChange("fecha")} />
            {errors.fecha && <span className="form-error">{errors.fecha}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="cita-hora">{t("agenda.time")}</label>
            <input id="cita-hora" type="time" value={form.hora} onChange={handleChange("hora")} />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="cita-cliente">{t("agenda.client")}</label>
          <select id="cita-cliente" value={form.client_id} onChange={handleChange("client_id")}>
            <option value="">{t("agenda.noClient")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="cita-actividades">{t("agenda.activities")}</label>
          <textarea
            id="cita-actividades"
            rows={4}
            placeholder={t("agenda.activitiesPlaceholder")}
            value={form.actividades}
            onChange={handleChange("actividades")}
          />
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/agenda")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
