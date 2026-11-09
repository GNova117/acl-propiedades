import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { OFFICE_WHATSAPP } from "../../lib/office";
import { PORTAL_FIELD_DEFS, PortalUploadError, portalAcceptsImage } from "../../lib/clientPortal";
import { compressImageFile } from "../../lib/imageCompression";
import PortalChecklistBadge from "./PortalChecklistBadge";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const PDF_ONLY = "application/pdf";
const PDF_OR_PHOTO = "application/pdf,image/jpeg,image/png";

function helpWhatsappHref(t, docLabel) {
  const text = t("portal.upload.helpWhatsappText", { doc: docLabel });
  return `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

// `item` es la fila de la lista de pendientes (lib/clientPortal.js,
// portalChecklist): trae el estado ("pendiente", "corregir", "en_revision",
// "aprobado", "recibido") y el documento que lo define. Solo la constancia y
// el acta tienen campos leídos automáticamente que confirmar; el resto se
// sube (PDF o foto) y espera la revisión del asesor.
export default function PortalDocumentCard({ token, item, officialUrl, backupDoc, onChanged }) {
  const { t } = useTranslation();
  const { docType, state } = item;
  const doc = item.doc?.source === "client_portal" ? item.doc : null;
  const label = t(`documentCapture.docTypes.${docType}`);
  const fieldDefs = PORTAL_FIELD_DEFS[docType] || [];
  const steps = t(`portal.docTypes.${docType}.steps`, { returnObjects: true });
  const acceptsImage = portalAcceptsImage(docType);
  const accept = acceptsImage ? PDF_OR_PHOTO : PDF_ONLY;
  // Ya listo (entregado en la oficina o aprobado): no se le invita a subirlo
  // de nuevo, aunque puede reemplazarlo si su asesor se lo pide.
  const settled = state === "recibido" || state === "aprobado";
  const needsUpload = state === "pendiente" || state === "corregir";

  const [showGuide, setShowGuide] = useState(needsUpload);
  const [uploading, setUploading] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fields, setFields] = useState(doc?.extracted_data || {});
  const [savingConfirm, setSavingConfirm] = useState(false);

  const handleUpload = async (e, fileKind) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setUploadError("");
    // Una foto de celular suele pasar de 3 MB: se reescala (1920 px, JPEG)
    // antes de rechazarla, que sigue siendo legible para una INE o un recibo.
    const file = picked.size > MAX_FILE_BYTES && picked.type?.startsWith("image/") ? await compressImageFile(picked) : picked;
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

  const uploadLabel = acceptsImage ? t("portal.upload.selectPdfOrPhoto") : t("portal.upload.selectPdf");
  const backupLabel = t(`portal.docTypes.${docType}.backupLabel`, { defaultValue: t("portal.upload.selectBackup") });

  return (
    <div className={`card portal-doc-card portal-doc-card--${state}`} id={`portal-doc-${docType}`}>
      <div className="portal-doc-card__header">
        <h3>{label}</h3>
        <PortalChecklistBadge state={state} />
      </div>

      {state === "corregir" && doc?.review_notes && (
        <p className="form-error">{t("portal.rejectedNote", { reason: doc.review_notes })}</p>
      )}
      {state === "recibido" && <p className="form-hint">{t("portal.checklist.receivedHint")}</p>}
      {doc?.extracted_data?.alertaVigencia && <p className="form-hint portal-doc-card__warning">{t("portal.ageWarning")}</p>}

      {showGuide && (
        <div className="portal-doc-card__guide">
          <ol>
            {Array.isArray(steps) && steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
          <div className="portal-doc-card__guide-actions">
            {officialUrl && (
              <a className="btn btn-outline btn-sm" href={officialUrl} target="_blank" rel="noopener noreferrer">
                {t(`portal.docTypes.${docType}.officialUrlLabel`)}
              </a>
            )}
            <a className="btn btn-outline btn-sm" href={helpWhatsappHref(t, label)} target="_blank" rel="noopener noreferrer">
              {t("portal.upload.helpWhatsapp")}
            </a>
          </div>
        </div>
      )}

      {needsUpload && (
        <div className="portal-doc-card__upload">
          <label className="btn btn-primary btn-block">
            <input type="file" accept={accept} hidden disabled={uploading} onChange={(e) => handleUpload(e, "document")} />
            {uploading ? <span className="spinner" /> : null}
            {uploading ? t("portal.upload.uploading") : uploadLabel}
          </label>
          {uploadError && <p className="form-error">{uploadError}</p>}
        </div>
      )}

      {!needsUpload && (
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? t("portal.guide.hide") : t("portal.guide.show")}
          </button>

          {doc && fieldDefs.length > 0 && !settled && (
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
          )}

          <div className="portal-doc-card__actions">
            {doc && fieldDefs.length > 0 && !settled && (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={savingConfirm}>
                {savingConfirm ? <span className="spinner" /> : null}
                {doc.client_confirmed ? t("portal.saveChanges") : t("portal.confirm")}
              </button>
            )}
            {doc?.client_confirmed && fieldDefs.length > 0 && !savingConfirm && <span className="form-hint">{t("portal.confirmed")}</span>}

            <label className="btn btn-outline btn-sm">
              <input type="file" accept={accept} hidden disabled={uploading} onChange={(e) => handleUpload(e, "document")} />
              {uploading ? <span className="spinner" /> : settled ? t("portal.upload.sendNew") : t("portal.upload.replace")}
            </label>

            {doc && !settled && !backupDoc && (
              <label className="btn btn-outline btn-sm">
                <input type="file" accept="image/jpeg,image/png" hidden disabled={uploadingBackup} onChange={(e) => handleUpload(e, "backup_image")} />
                {uploadingBackup ? <span className="spinner" /> : backupLabel}
              </label>
            )}
            {doc && backupDoc && <span className="form-hint">{t("portal.upload.backupAdded")}</span>}
          </div>
          {uploadError && <p className="form-error">{uploadError}</p>}
        </>
      )}
    </div>
  );
}
