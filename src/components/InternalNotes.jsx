import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { useAuth } from "../context/AuthContext";
import { formatVisitDateTime } from "../lib/visitReport";
import "./InternalNotes.css";

// Comunicación interna del equipo sobre un cliente/prospecto/propiedad: notas
// visibles para cualquier asesor que entre a esa ficha, con la opción de
// etiquetar a compañeros específicos ("Notificar a:") para que quede claro
// quién debería verla. No manda un push de verdad (eso requiere el backend
// real de notificaciones, no disponible en modo demo) — por ahora es un
// tablón compartido dentro de la ficha.
export default function InternalNotes({ entityType, entityId }) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const myEmail = session?.user?.email || "";

  const [notes, setNotes] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    db.getInternalNotes(entityType, entityId)
      .then(setNotes)
      .finally(() => setLoading(false));
  };

  useEffect(load, [entityType, entityId]);
  useEffect(() => {
    db.getAdvisors().then(setAdvisors).catch(() => setAdvisors([]));
  }, []);

  const advisorByEmail = useMemo(() => new Map(advisors.filter((a) => a.email).map((a) => [a.email, a.name])), [advisors]);

  const toggleMention = (email) => {
    setMentions((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await db.addInternalNote({ entityType, entityId, body, mentions });
      setBody("");
      setMentions([]);
      load();
    } catch (err) {
      window.alert(err.message || t("internalNotes.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingId(note.id);
    try {
      await db.deleteInternalNote(note.id);
      load();
    } catch (err) {
      window.alert(err.message || t("internalNotes.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card internal-notes">
      <h2>{t("internalNotes.title")}</h2>
      <p className="form-hint">{t("internalNotes.subtitle")}</p>

      <form onSubmit={handleSubmit} className="internal-notes__form">
        <div className="form-field">
          <label htmlFor="internal-note-body">{t("internalNotes.newNote")}</label>
          <textarea id="internal-note-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {advisors.filter((a) => a.email).length > 0 && (
          <div className="form-field">
            <label>{t("internalNotes.notify")}</label>
            <div className="internal-notes__mentions">
              {advisors
                .filter((a) => a.email)
                .map((a) => (
                  <label key={a.id} className="internal-notes__mention-option">
                    <input type="checkbox" checked={mentions.includes(a.email)} onChange={() => toggleMention(a.email)} />
                    {a.name}
                  </label>
                ))}
            </div>
          </div>
        )}
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !body.trim()}>
            {saving ? <span className="spinner" /> : null}
            {t("internalNotes.add")}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="form-hint">{t("common.loading")}</p>
      ) : notes.length === 0 ? (
        <p className="form-hint">{t("internalNotes.empty")}</p>
      ) : (
        <ul className="internal-notes__list">
          {notes.map((note) => (
            <li key={note.id} className="internal-notes__item">
              <div className="internal-notes__item-head">
                <strong>{note.author_email === myEmail ? t("internalNotes.you") : note.author_email}</strong>
                <span className="form-hint">{formatVisitDateTime(note.created_at, i18n.language)}</span>
              </div>
              <p>{note.body}</p>
              {note.mentions?.length > 0 && (
                <div className="internal-notes__chips">
                  {note.mentions.map((email) => (
                    <span key={email} className="internal-notes__chip">
                      {advisorByEmail.get(email) || email}
                    </span>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDelete(note)} disabled={deletingId === note.id}>
                {t("common.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
