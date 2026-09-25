import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { whatsappDigits } from "../../lib/format";
import { messageToProspectFields } from "../../lib/prospects";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

const PREVIEW_LENGTH = 80;

// Prefill para "Crear cliente" / "Agendar cita" desde un mensaje — ninguno
// de los dos formularios necesita una tabla ni un endpoint nuevo, solo
// arrancar con estos campos ya llenos (vía location.state) en vez de en
// blanco, para no hacer que el nombre/teléfono/correo que la persona ya
// escribió se vuelva a teclear a mano.
function clientPrefill(message) {
  return {
    name: message.name,
    phone: message.phone || "",
    email: message.email,
    notes: `Creado desde un mensaje de contacto del sitio:\n\n${message.message}`,
  };
}

function visitPrefill(message) {
  return {
    titulo: `Cita con ${message.name}`,
    actividades: `Solicitud desde Mensajes de contacto.\nTeléfono: ${message.phone || "—"}\nCorreo: ${message.email || "—"}\n\n${message.message}`,
  };
}

export default function AdminMessages() {
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const [messages, setMessages] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [promotingId, setPromotingId] = useState(null);

  const load = () => {
    setLoading(true);
    // Las propiedades vienen con sus asesores incluidos (property_advisors),
    // así que no hace falta una consulta aparte de asesores: el mensaje
    // guarda property_id y de ahí se deriva a quién le toca. Derivado, no
    // copiado: si mañana se reasigna la propiedad a otro asesor, los
    // mensajes viejos apuntan al asesor que la lleva hoy, que es a quien
    // hay que buscar para darles seguimiento.
    Promise.all([db.getContactMessages(), db.getProperties({})]).then(([messageData, propertyData]) => {
      setMessages(messageData);
      setProperties(propertyData);
      setLoading(false);
    });
  };

  useEffect(load, []);

  // Mensajes que ya son prospecto (para no ofrecer el botón dos veces).
  useEffect(() => {
    if (hasSection("prospectos")) db.getProspects().then(setProspects).catch(() => setProspects([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const promotedIds = useMemo(() => new Set(prospects.map((p) => p.message_id).filter(Boolean)), [prospects]);

  const handleMakeProspect = async (message) => {
    setPromotingId(message.id);
    try {
      const created = await db.addProspect(messageToProspectFields(message, propertyById.get(message.property_id)));
      setProspects((prev) => [created, ...prev]);
    } catch (err) {
      window.alert(err.message || t("messages.makeProspectError"));
    } finally {
      setPromotingId(null);
    }
  };

  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const advisorOptions = useMemo(() => {
    const byId = new Map();
    properties.forEach((p) => (p.advisors || []).forEach((a) => byId.set(a.id, a)));
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  const messageAdvisors = (message) => propertyById.get(message.property_id)?.advisors || [];

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (statusFilter && (m.status || "nuevo") !== statusFilter) return false;
      if (advisorFilter) {
        const advisors = propertyById.get(m.property_id)?.advisors || [];
        // "Sin asesor": mensajes del formulario de Contacto (sin propiedad)
        // y propiedades que todavía no tienen a nadie asignado — son los
        // que nadie está viendo como propios, así que conviene poder
        // aislarlos.
        if (advisorFilter === "none") return advisors.length === 0;
        if (!advisors.some((a) => a.id === advisorFilter)) return false;
      }
      return true;
    });
  }, [messages, statusFilter, advisorFilter, propertyById]);

  const handleToggleStatus = async (message) => {
    const next = (message.status || "nuevo") === "nuevo" ? "atendido" : "nuevo";
    setUpdatingId(message.id);
    try {
      await db.updateContactMessageStatus(message.id, next);
      load();
    } catch (err) {
      window.alert(err.message || "Error al actualizar el mensaje");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingId(id);
    try {
      await db.deleteContactMessage(id);
      load();
    } catch (err) {
      window.alert(err.message || "Error al eliminar el mensaje");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("messages.title")}</h1>
      </div>
      <p className="form-hint" style={{ marginTop: "-0.75rem", marginBottom: "1.25rem" }}>{t("messages.subtitle")}</p>

      <div className="form-row" style={{ maxWidth: 560, marginBottom: "1.25rem" }}>
        <div className="form-field">
          <label htmlFor="message-status-filter">{t("common.status")}</label>
          <select id="message-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("messages.filterAll")}</option>
            <option value="nuevo">{t("messages.statusNew")}</option>
            <option value="atendido">{t("messages.statusHandled")}</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="message-advisor-filter">{t("messages.advisor")}</label>
          <select id="message-advisor-filter" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
            <option value="">{t("messages.allAdvisors")}</option>
            {advisorOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
            <option value="none">{t("messages.noAdvisor")}</option>
          </select>
        </div>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("messages.date")}</th>
              <th>{t("contact.name")}</th>
              <th>{t("contact.phone")}</th>
              <th>{t("contact.email")}</th>
              <th>{t("contact.message")}</th>
              <th>{t("messages.propertyAndAdvisor")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>{t("common.loading")}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>{t("messages.noResults")}</td></tr>
            ) : (
              filtered.map((message) => {
                const isNew = (message.status || "nuevo") === "nuevo";
                const expanded = expandedId === message.id;
                const digits = whatsappDigits(message.phone);
                const isLong = (message.message || "").length > PREVIEW_LENGTH;
                const shownText = expanded || !isLong ? message.message : `${message.message.slice(0, PREVIEW_LENGTH)}…`;

                return (
                  <tr key={message.id}>
                    <td>{new Date(message.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>
                      {message.name}
                      {message.channel === "whatsapp" && <span className="form-hint" style={{ display: "block", margin: 0 }}>{t("messages.viaWhatsapp")}</span>}
                    </td>
                    <td>{message.phone || "—"}</td>
                    <td>{message.email || "—"}</td>
                    <td style={{ whiteSpace: "normal", maxWidth: 280 }}>
                      {shownText}
                      {isLong && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ marginLeft: "0.4rem" }}
                            onClick={() => setExpandedId(expanded ? null : message.id)}
                          >
                            {expanded ? t("messages.showLess") : t("messages.showFull")}
                          </button>
                        </>
                      )}
                    </td>
                    <td style={{ whiteSpace: "normal", maxWidth: 200 }}>
                      {(() => {
                        const property = propertyById.get(message.property_id);
                        if (!property) return t("messages.generalInquiry");
                        const advisors = messageAdvisors(message);
                        return (
                          <>
                            {property.code ? `${property.code} · ` : ""}
                            {property.title}
                            <span className="form-hint" style={{ display: "block", margin: 0 }}>
                              {advisors.length > 0 ? advisors.map((a) => a.name).join(", ") : t("messages.noAdvisor")}
                            </span>
                          </>
                        );
                      })()}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`badge ${isNew ? "badge-reserved" : "badge-available"}`}
                        onClick={() => handleToggleStatus(message)}
                        disabled={updatingId === message.id}
                      >
                        {isNew ? t("messages.statusNew") : t("messages.statusHandled")}
                      </button>
                    </td>
                    <td className="admin-table__actions">
                      {digits && (
                        <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                          {t("detail.whatsapp")}
                        </a>
                      )}
                      {message.email && (
                        <a href={`mailto:${message.email}`} className="btn btn-outline btn-sm">
                          {t("detail.email")}
                        </a>
                      )}
                      {hasSection("prospectos") &&
                        (promotedIds.has(message.id) ? (
                          <Link to="/admin/prospectos" className="btn btn-outline btn-sm">
                            {t("messages.isProspect")}
                          </Link>
                        ) : (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleMakeProspect(message)} disabled={promotingId === message.id}>
                            {t("messages.makeProspect")}
                          </button>
                        ))}
                      {hasSection("clientes") && (
                        <Link to="/admin/clientes/nuevo" state={{ prefill: clientPrefill(message) }} className="btn btn-outline btn-sm">
                          {t("messages.createClient")}
                        </Link>
                      )}
                      {hasSection("agenda") && (
                        <Link to="/admin/agenda/nueva" state={{ prefill: visitPrefill(message) }} className="btn btn-outline btn-sm">
                          {t("messages.scheduleAppointment")}
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(message.id)}
                        disabled={deletingId === message.id}
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
