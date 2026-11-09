import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { citaContact, citaStatus, isOpenRequest, visitLink, visitLinkTextKey } from "../../lib/agendaCitas";
import VisitLinkPanel from "../../components/VisitLinkPanel";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

const EMPTY = { advisor_id: "", client_id: "", titulo: "", fecha: "", hora: "", actividades: "", lugar: "", contact_name: "", contact_phone: "", contact_email: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminAgendaForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { advisorId } = useAuth();

  // "Agendar cita" desde un mensaje de contacto (/admin/mensajes) llega
  // aquí con state.prefill (título + actividades con el teléfono/correo/
  // texto del mensaje) — a diferencia de la solicitud de visita del sitio
  // público (que llega como mensaje para revisar, no entra directo aquí),
  // esta sí cae directo en la Agenda porque quien la crea ya es alguien
  // del equipo decidiendo agendarla. Fecha/hora se dejan en blanco a
  // propósito: parsear una fecha en texto libre del mensaje no vale el
  // riesgo de adivinar mal, es más rápido que quien agenda la escriba.
  const [form, setForm] = useState(() => (!isEdit && location.state?.prefill ? { ...EMPTY, ...location.state.prefill } : EMPTY));
  const [advisors, setAdvisors] = useState([]);
  const [clients, setClients] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  // Solicitud de visita sin asesor: no se edita hasta que alguien la toma (desde la Agenda o Mi día).
  const [openRequest, setOpenRequest] = useState(false);
  const [citaRow, setCitaRow] = useState(null); // la cita guardada (para su enlace)
  // ¿La cita ya tenía lugar guardado? Solo entonces se manda vacío para borrarlo;
  // si nunca tuvo y sigue sin nada, el campo ni se envía (ver supabaseBackend).
  const hadLugar = useRef(false);

  useEffect(() => {
    Promise.all([db.getAdvisors(), db.getClients(), isEdit ? db.getAgendaCitaById(id) : Promise.resolve(null)]).then(
      ([advisorData, clientData, cita]) => {
        setAdvisors(advisorData);
        setClients(clientData);
        if (cita) {
          setOpenRequest(isOpenRequest(cita));
          setCitaRow(cita);
          hadLugar.current = Boolean(cita.lugar);
          setForm({
            advisor_id: cita.advisor_id,
            client_id: cita.client_id || "",
            titulo: cita.titulo,
            fecha: cita.fecha,
            hora: cita.hora ? cita.hora.slice(0, 5) : "",
            actividades: cita.actividades || "",
            lugar: cita.lugar || "",
            contact_name: cita.contact_name || "",
            contact_phone: cita.contact_phone || "",
            contact_email: cita.contact_email || "",
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
    if (!form.client_id) {
      if (form.contact_email.trim() && !EMAIL_RE.test(form.contact_email.trim())) next.contact_email = t("agenda.contactEmailInvalid");
      const digits = form.contact_phone.replace(/\D/g, "");
      if (form.contact_phone.trim() && (digits.length < 10 || digits.length > 15)) next.contact_phone = t("agenda.contactPhoneInvalid");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { lugar, ...rest } = form;
      // Con un cliente registrado los datos de contacto salen de él: no se guardan aparte.
      const contact = form.client_id ? { contact_name: "", contact_phone: "", contact_email: "" } : {};
      const payload = lugar.trim() || hadLugar.current ? { ...rest, ...contact, lugar } : { ...rest, ...contact };
      if (isEdit) {
        await db.updateAgendaCita(id, payload);
        navigate("/admin/agenda");
      } else {
        // Al crear se abre la cita ya guardada, con su enlace arriba para mandárselo al cliente.
        const created = await db.addAgendaCita(payload);
        navigate(`/admin/agenda/${created.id}`, { state: { saved: true } });
      }
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Enlace de una cita ya guardada y el mensaje de WhatsApp para mandárselo (con el cliente ligado o los datos de contacto).
  const linkInfo = (cita) => {
    const link = cita.status === undefined || citaStatus(cita) === "confirmada" ? visitLink(cita, window.location.origin) : "";
    if (!link) return null;
    const contact = citaContact(cita, clients.find((c) => c.id === cita.client_id) || null);
    const date = new Date(`${cita.fecha}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    const text = t(visitLinkTextKey(cita), {
      name: contact.name.split(/\s+/)[0],
      advisor: advisors.find((a) => a.id === cita.advisor_id)?.name || "",
      title: cita.titulo,
      when: `${date} a las ${String(cita.hora).slice(0, 5)}`,
      link,
    });
    return { link, phone: contact.phone, text };
  };

  const justSaved = Boolean(isEdit && location.state?.saved && citaRow);
  const linkPanel = (fallback) => {
    const info = citaRow ? linkInfo(citaRow) : null;
    return info ? <VisitLinkPanel link={info.link} phone={info.phone} text={info.text} /> : fallback;
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  if (openRequest) {
    return (
      <div>
        <div className="admin-header">
          <h1>{t("agenda.editAppointment")}</h1>
        </div>
        <div className="card">
          <p>{t("agenda.requestFormNote")}</p>
          <Link to="/admin/agenda" className="btn btn-outline">
            {t("myDay.fullAgenda")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("agenda.editAppointment") : t("agenda.newAppointment")}</h1>
      </div>

      {justSaved && (
        <div className="card" role="status">
          <strong>{t("agenda.saved")}</strong> <span className="form-hint">{t("agenda.savedBody")}</span>
          {linkPanel(<p className="form-hint">{t("visitLink.needsTime")}</p>)}
        </div>
      )}

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

        {!form.client_id && (
          <fieldset className="form-field agenda-contact">
            <legend>{t("agenda.contactTitle")}</legend>
            <span className="form-hint">{t("agenda.contactHint")}</span>
            <div className="form-field">
              <label htmlFor="cita-contact-name">{t("agenda.contactName")}</label>
              <input id="cita-contact-name" value={form.contact_name} onChange={handleChange("contact_name")} autoComplete="off" />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="cita-contact-phone">{t("agenda.contactPhone")}</label>
                <input id="cita-contact-phone" type="tel" value={form.contact_phone} onChange={handleChange("contact_phone")} autoComplete="off" aria-invalid={Boolean(errors.contact_phone)} />
                {errors.contact_phone && <span className="form-error">{errors.contact_phone}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="cita-contact-email">{t("agenda.contactEmail")}</label>
                <input id="cita-contact-email" type="email" value={form.contact_email} onChange={handleChange("contact_email")} autoComplete="off" aria-invalid={Boolean(errors.contact_email)} />
                {errors.contact_email && <span className="form-error">{errors.contact_email}</span>}
              </div>
            </div>
          </fieldset>
        )}

        <div className="form-field">
          <label htmlFor="cita-lugar">{t("agenda.place")}</label>
          <input id="cita-lugar" value={form.lugar} onChange={handleChange("lugar")} placeholder={t("agenda.placePlaceholder")} />
          <span className="form-hint">{t("agenda.placeHint")}</span>
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

      {isEdit && !justSaved && linkPanel(null)}
    </div>
  );
}
