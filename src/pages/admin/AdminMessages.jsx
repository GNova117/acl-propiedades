import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { whatsappDigits } from "../../lib/format";
import "./admin.css";

const PREVIEW_LENGTH = 80;

export default function AdminMessages() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    db.getContactMessages().then((data) => {
      setMessages(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!statusFilter) return messages;
    return messages.filter((m) => (m.status || "nuevo") === statusFilter);
  }, [messages, statusFilter]);

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

      <div className="form-field" style={{ maxWidth: 220, marginBottom: "1.25rem" }}>
        <label htmlFor="message-status-filter">{t("common.status")}</label>
        <select id="message-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t("messages.filterAll")}</option>
          <option value="nuevo">{t("messages.statusNew")}</option>
          <option value="atendido">{t("messages.statusHandled")}</option>
        </select>
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
              <th>{t("common.status")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>{t("common.loading")}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}>{t("messages.noResults")}</td></tr>
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
                    <td>{message.name}</td>
                    <td>{message.phone || "—"}</td>
                    <td>{message.email}</td>
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
                      <a href={`mailto:${message.email}`} className="btn btn-outline btn-sm">
                        {t("detail.email")}
                      </a>
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
