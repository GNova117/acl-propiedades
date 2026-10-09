import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { OFFICE_WHATSAPP } from "../../lib/office";
import { PORTAL_FIELD_DEFS, PortalUploadError } from "../../lib/clientPortal";
import PortalStatusBadge from "./PortalStatusBadge";

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function helpWhatsappHref(t, docLabel) {
  const text = t("portal.upload.helpWhatsappText", { doc: docLabel });
  return `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export default function PortalDocumentCard({ token, docType, officialUrl, doc, backupDoc, onChanged }) {
  const { t } = useTranslation();
  const label = t(`documentCapture.docTypes.${docType}`);
  const fieldDefs = PORTAL_FIELD_DEFS[docType] || [];
  const steps = t(`portal.docTypes.${docType}.steps`, { returnObjects: true });

  const [showGuide, setShowGuide] = useState(!doc);
  const [uploading, setUploading] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fields, setFields] = useState(doc?.extracted_data || {});
  const [savingConfirm, setSavingConfirm] = useState(false);

  const handleUpload = async (e, fileKind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError("");
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(t("portal.errors.file_too_large"));
      return;
    }
    const setBusy = fileKind === "backup_image" ? setUploadingBackup : setUploading;
    setBusy(true);
    try {
      await db.uploadPortalDocument(token, { docType, fileKind, file });
      setShowGuide(false);
      await onChanged();
    } catch (err) {
      const code = err instanceof PortalUploadError ? err.code : "server_error";
      setUploadError(t(`portal.errors.${code}`, { defaultValue: t("portal.errors.server_error") }));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setSavingConfirm(true);
    try {
      await db.confirmPortalDocument(token, doc.id, fields, true);
      await onChanged();
    } finally {
      setSavingConfirm(false);
    }
  };

  const missing = new Set(doc?.extracted_data?.camposFaltantes || []);

  return (
    <div className="card portal-doc-card">
      <div className="portal-doc-card__header">
        <h3>{label}</h3>
        {doc && <PortalStatusBadge status={doc.review_status} />}
      </div>

      {doc?.review_status === "rechazado" && doc.review_notes && (
        <p className="form-error">{t("portal.rejectedNote", { reason: doc.review_notes })}</p>
      )}
      {doc?.extracted_data?.alertaVigencia && <p className="form-hint portal-doc-card__warning">{t("portal.ageWarning")}</p>}

      {(showGuide || !doc) && (
        <div className="portal-doc-card__guide">
          <ol>
            {Array.isArray(steps) && steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
          <div className="portal-doc-card__guide-actions">
            <a className="btn btn-outline btn-sm" href={officialUrl} target="_blank" rel="noopener noreferrer">
              {t(`portal.docTypes.${docType}.officialUrlLabel`)}
            </a>
            <a className="btn btn-outline btn-sm" href={helpWhatsappHref(t, label)} target="_blank" rel="noopener noreferrer">
              {t("portal.upload.helpWhatsapp")}
            </a>
          </div>
        </div>
      )}

      {!doc && (
        <div className="portal-doc-card__upload">
          <label className="btn btn-primary btn-block">
            <input type="file" accept="application/pdf" hidden disabled={uploading} onChange={(e) => handleUpload(e, "document")} />
            {uploading ? <span className="spinner" /> : null}
            {uploading ? t("portal.upload.uploading") : t("portal.upload.selectPdf")}
          </label>
          {uploadError && <p className="form-error">{uploadError}</p>}
        </div>
      )}

      {doc && (
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? t("portal.guide.hide") : t("portal.guide.show")}
          </button>

          <div className="portal-doc-card__fields">
            {fieldDefs.map((f) => (
              <div className="form-field" key={f.key}>
                <label htmlFor={`${docType}-${f.key}`}>
                  {t(f.labelKey)}
                  {missing.has(f.key) && <span className="portal-doc-card__missing"> — {t("portal.missingField")}</span>}
                </label>
                <input
                  id={`${docType}-${f.key}`}
                  value={fields[f.key] || ""}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="portal-doc-card__actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={savingConfirm}>
              {savingConfirm ? <span className="spinner" /> : null}
              {doc.client_confirmed ? t("portal.saveChanges") : t("portal.confirm")}
            </button>
            {doc.client_confirmed && !savingConfirm && <span className="form-hint">{t("portal.confirmed")}</span>}

            <label className="btn btn-outline btn-sm">
              <input type="file" accept="application/pdf" hidden disabled={uploading} onChange={(e) => handleUpload(e, "document")} />
              {uploading ? <span className="spinner" /> : t("portal.upload.replace")}
            </label>

            {!backupDoc && (
              <label className="btn btn-outline btn-sm">
                <input type="file" accept="image/jpeg,image/png" hidden disabled={uploadingBackup} onChange={(e) => handleUpload(e, "backup_image")} />
                {uploadingBackup ? <span className="spinner" /> : t("portal.upload.selectBackup")}
              </label>
            )}
            {backupDoc && <span className="form-hint">{t("portal.upload.backupAdded")}</span>}
          </div>
          {uploadError && <p className="form-error">{uploadError}</p>}
        </>
      )}
    </div>
  );
}
