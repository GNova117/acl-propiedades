import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { PORTAL_FIELD_DEFS } from "../../lib/clientPortal";
import PortalStatusBadge from "./PortalStatusBadge";

// Mini-panel de revisión que aparece junto a un documento subido por el
// PROPIO cliente desde /documentos/<token> (doc.source === "client_portal"):
// lo que la extracción automática leyó, y Aprobar/Rechazar con motivo. Un
// documento capturado por el asesor (admin_capture) no lo muestra — no
// pasa por este flujo de revisión.
export default function AdminPortalDocumentReview({ doc, clientId, onChanged }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(doc.review_notes || "");
  const [busy, setBusy] = useState(false);
  const fieldDefs = PORTAL_FIELD_DEFS[doc.doc_type] || [];

  const review = async (reviewStatus) => {
    if (reviewStatus === "rechazado" && !notes.trim()) {
      window.alert(t("adminPortal.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await db.reviewClientDocument(doc.id, clientId, { reviewStatus, reviewNotes: notes.trim() || null });
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (doc.file_kind === "backup_image") {
    return <p className="form-hint">{t("adminPortal.backupImage")}</p>;
  }

  return (
    <div className="admin-doc-card__portal-review">
      <div>
        <PortalStatusBadge status={doc.review_status} /> <span className="form-hint">{t("adminPortal.fromPortal")}</span>
        {doc.client_confirmed ? null : <span className="form-hint"> · {t("adminPortal.notConfirmed")}</span>}
      </div>

      <div className="admin-doc-card__portal-fields">
        {fieldDefs.map((f) => (
          <div key={f.key}>
            <strong>{t(f.labelKey)}:</strong> {doc.extracted_data?.[f.key] || t("adminPortal.notRead")}
          </div>
        ))}
        {doc.extracted_data?.alertaVigencia && <div className="form-error">{t("portal.ageWarning")}</div>}
        {doc.qr_validated === false && <div className="form-error">{t("adminPortal.qrMismatch")}</div>}
        {doc.qr_validated === null && <div>{t("adminPortal.qrUnread")}</div>}
      </div>

      {doc.review_status !== "valido" && doc.review_status !== "rechazado" && (
        <>
          <textarea
            rows={2}
            placeholder={t("adminPortal.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="admin-doc-card__actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => review("valido")}>
              {t("adminPortal.approve")}
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => review("rechazado")}>
              {t("adminPortal.reject")}
            </button>
          </div>
        </>
      )}
      {doc.review_status === "rechazado" && doc.review_notes && <p className="form-error">{t("adminPortal.rejectedReason", { reason: doc.review_notes })}</p>}
    </div>
  );
}
