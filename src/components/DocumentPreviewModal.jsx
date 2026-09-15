import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { isPdfDoc } from "../lib/format";
import { downloadClientDocumentAsPdf } from "../lib/clientDocPdf";
import "./DocumentPreviewModal.css";

// Vista previa de un documento de cliente ya capturado/subido: un PDF se
// renderiza en un <iframe> (el visor nativo del navegador), una imagen en
// un <img> normal. El botón de descarga siempre entrega un .pdf — para una
// imagen se convierte al vuelo (ver lib/clientDocPdf.js) para que el
// resultado sea uniforme sin importar cómo se capturó el documento.
//
// No se usa doc.signed_url directo: esa URL se firmó al cargar la lista de
// documentos y expira a los 300s (ver supabaseBackend.js), así que si la
// pantalla lleva un rato abierta ya está vencida al momento de abrir la
// vista previa. Se pide una nueva al montar el modal.
export default function DocumentPreviewModal({ doc, title, subtitle, filePrefix, onClose }) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewErrorDetail, setPreviewErrorDetail] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [downloadErrorDetail, setDownloadErrorDetail] = useState("");

  useEffect(() => {
    let active = true;
    setPreviewUrl(null);
    setPreviewFailed(false);
    db.getClientDocumentUrl(doc)
      .then((url) => {
        if (active) setPreviewUrl(url);
      })
      .catch((err) => {
        console.error("getClientDocumentUrl", err);
        if (active) {
          setPreviewFailed(true);
          setPreviewErrorDetail(err?.message || String(err));
        }
      });
    return () => {
      active = false;
    };
  }, [doc]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadFailed(false);
    try {
      await downloadClientDocumentAsPdf(doc, filePrefix);
    } catch (err) {
      console.error("downloadClientDocumentAsPdf", err);
      setDownloadFailed(true);
      setDownloadErrorDetail(err?.message || String(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="document-preview">
      <div className="document-preview__header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="form-hint">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="document-preview__close"
          onClick={onClose}
          aria-label={t("documentCapture.closePreview")}
        >
          ×
        </button>
      </div>

      <div className="document-preview__stage">
        {previewFailed ? (
          <p className="form-error">
            {t("documentCapture.previewError")} ({previewErrorDetail})
          </p>
        ) : !previewUrl ? (
          <span className="spinner" />
        ) : isPdfDoc(doc) ? (
          <iframe src={previewUrl} title={title} className="document-preview__frame" />
        ) : (
          <img src={previewUrl} alt="" className="document-preview__image" />
        )}
      </div>

      <div className="document-preview__actions">
        {downloadFailed && (
          <p className="form-error">
            {t("documentCapture.downloadError")} ({downloadErrorDetail})
          </p>
        )}
        <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          {downloading ? <span className="spinner" /> : null}
          {t("documentCapture.downloadPdf")}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
