import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import {
  PORTAL_UPLOADABLE_DOC_TYPES,
  checklistSummary,
  defaultRequestedDocs,
  portalChecklist,
  requestedDocsFor,
  tramiteStagesFor,
} from "../../lib/clientPortal";
import PortalChecklistBadge from "./PortalChecklistBadge";

// En la ficha de documentos del cliente: lo que verá en su portal. El asesor
// marca qué documentos le pide, en qué etapa va su trámite y, si quiere, una
// nota para él ("Ya agendamos el avalúo para el jueves"). Abajo, la misma
// lista de pendientes que ve el cliente, para saber qué le falta sin abrir
// el portal.
export default function AdminPortalTramitePanel({ client, documents, onSaved }) {
  const { t } = useTranslation();
  const [tramite, setTramite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [requested, setRequested] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const stages = tramiteStagesFor(client);

  useEffect(() => {
    let cancelled = false;
    db.getClientTramite(client.id)
      .then((row) => {
        if (cancelled) return;
        setTramite(row);
        setStage(row?.stage && stages.includes(row.stage) ? row.stage : stages[0]);
        setNote(row?.note || "");
        setRequested(requestedDocsFor(row, client.type));
      })
      .catch(() => {
        if (cancelled) return;
        setStage(stages[0]);
        setRequested(defaultRequestedDocs(client.type));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const portalDocs = useMemo(() => documents.filter((d) => d.source === "client_portal"), [documents]);
  const officeDocs = useMemo(() => documents.filter((d) => (d.source || "admin_capture") === "admin_capture"), [documents]);
  const checklist = portalChecklist(requested, portalDocs, officeDocs);
  const summary = checklistSummary(checklist);

  const toggleDoc = (docType) => {
    setMessage("");
    setRequested((prev) =>
      prev.includes(docType) ? prev.filter((d) => d !== docType) : PORTAL_UPLOADABLE_DOC_TYPES.filter((d) => d === docType || prev.includes(d))
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (requested.length === 0) {
      setError(t("adminPortal.tramite.needOneDoc"));
      return;
    }
    setSaving(true);
    try {
      const saved = await db.saveClientTramite(client.id, { stage, note, requestedDocs: requested });
      setTramite(saved);
      setMessage(t("adminPortal.tramite.saved"));
      onSaved?.(saved);
    } catch (err) {
      setError(err?.message || t("adminPortal.tramite.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <form className="card admin-portal-tramite" onSubmit={handleSave} aria-labelledby="admin-portal-tramite-title">
      <div className="admin-portal-tramite__header">
        <h2 id="admin-portal-tramite-title">{t("adminPortal.tramite.title")}</h2>
        <span className="form-hint">{t("portal.checklist.progress", { done: summary.done, total: summary.total })}</span>
      </div>
      <p className="form-hint">{t("adminPortal.tramite.hint")}</p>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="tramite-stage">{t("adminPortal.tramite.stage")}</label>
          <select id="tramite-stage" value={stage} onChange={(e) => { setStage(e.target.value); setMessage(""); }}>
            {stages.map((key, i) => (
              <option key={key} value={key}>
                {i + 1}. {t(`portal.tramite.stages.${key}.title`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="tramite-note">{t("adminPortal.tramite.note")}</label>
        <textarea
          id="tramite-note"
          rows={2}
          maxLength={500}
          placeholder={t("adminPortal.tramite.notePlaceholder")}
          value={note}
          onChange={(e) => { setNote(e.target.value); setMessage(""); }}
        />
      </div>

      <fieldset className="admin-portal-tramite__docs">
        <legend>{t("adminPortal.tramite.requestedDocs")}</legend>
        {PORTAL_UPLOADABLE_DOC_TYPES.map((docType) => {
          const item = checklist.find((i) => i.docType === docType);
          return (
            <label key={docType} className="admin-portal-tramite__doc">
              <input type="checkbox" checked={requested.includes(docType)} onChange={() => toggleDoc(docType)} />
              <span>{t(`documentCapture.docTypes.${docType}`)}</span>
              {item && <PortalChecklistBadge state={item.state} />}
            </label>
          );
        })}
      </fieldset>

      {error && <p className="form-error">{error}</p>}
      <div className="admin-portal-tramite__actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="spinner" /> : null}
          {t("adminPortal.tramite.save")}
        </button>
        {message && <span className="form-hint" role="status">{message}</span>}
        {tramite?.updated_at && !message && (
          <span className="form-hint">{t("adminPortal.tramite.lastUpdate", { date: new Date(tramite.updated_at).toLocaleString() })}</span>
        )}
      </div>
    </form>
  );
}
