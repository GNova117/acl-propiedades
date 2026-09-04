import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

const ENTRY_TYPES = [
  { key: "avance", labelKey: "remodelProgress.avanceTab" },
  { key: "recibo", labelKey: "remodelProgress.reciboTab" },
];

export default function AdminRemodelProgress() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [project, setProject] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingType, setAddingType] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [pendingNote, setPendingNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([db.getRemodelProjectById(id), db.getRemodelProgress(id)]).then(([projectData, entryData]) => {
      setProject(projectData);
      setEntries(entryData);
      setLoading(false);
    });
  };

  useEffect(load, [id]);

  const resetPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setAddingType(null);
    setPendingFile(null);
    setPendingPreview(null);
    setPendingNote("");
  };

  const handleFileSelect = (type) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setAddingType(type);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setPendingNote("");
  };

  const handleConfirmAdd = async () => {
    if (!pendingFile || !addingType) return;
    setSaving(true);
    try {
      await db.addRemodelProgress({ remodel_project_id: id, entry_type: addingType, blob: pendingFile, note: pendingNote.trim() });
      resetPending();
      load();
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteRemodelProgress(entryId);
    load();
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("remodelProgress.title")}</h1>
          <p className="form-hint">{project?.name}</p>
        </div>
        <Link to="/admin/remodelaciones" className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>

      <div className="admin-doc-grid">
        {ENTRY_TYPES.map(({ key, labelKey }) => {
          const entriesOfType = entries.filter((e) => e.entry_type === key);
          return (
            <div className="card admin-doc-card" key={key}>
              <h3>{t(labelKey)}</h3>

              {entriesOfType.length === 0 ? (
                <p className="form-hint">{t("remodelProgress.noEntries")}</p>
              ) : (
                <div className="admin-doc-card__list">
                  {entriesOfType.map((entry) => (
                    <div className="admin-doc-card__item" key={entry.id}>
                      <img src={entry.signed_url} alt="" />
                      {entry.note && <p style={{ margin: 0 }}>{entry.note}</p>}
                      <span className="form-hint">
                        {t("remodelProgress.addedAt")} {new Date(entry.created_at).toLocaleString()}
                      </span>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.id)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingType === key && pendingFile ? (
                <div className="admin-doc-card__item">
                  <img src={pendingPreview} alt="" />
                  <textarea
                    rows={2}
                    placeholder={t("remodelProgress.notePlaceholder")}
                    value={pendingNote}
                    onChange={(e) => setPendingNote(e.target.value)}
                  />
                  <div className="admin-table__actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirmAdd} disabled={saving}>
                      {saving ? <span className="spinner" /> : null}
                      {t("remodelProgress.confirmAdd")}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={resetPending} disabled={saving}>
                      {t("remodelProgress.cancelAdd")}
                    </button>
                  </div>
                </div>
              ) : (
                <label className="btn btn-primary btn-sm" style={{ cursor: "pointer" }}>
                  <input type="file" accept="image/*" onChange={handleFileSelect(key)} hidden />
                  {t("remodelProgress.addPhoto")}
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
