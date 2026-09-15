import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isPdfDoc } from "../lib/format";
import { downloadClientDocumentAsPdf } from "../lib/clientDocPdf";
import "./DocumentPreviewModal.css";

// Vista previa de un documento de cliente ya capturado/subido: un PDF se
// renderiza en un <iframe> (el visor nativo del navegador), una imagen en
// un <img> normal. El botón de descarga siempre entrega un .pdf — para una
// imagen se convierte al vuelo (ver lib/clientDocPdf.js) para que el
// resultado sea uniforme sin importar cómo se capturó el documento.
export default function DocumentPreviewModal({ doc, title, subtitle, filePrefix, onClose }) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadFailed(false);
    try {
      await downloadClientDocumentAsPdf(doc, filePrefix);
    } catch {
      setDownloadFailed(true);
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
        {isPdfDoc(doc) ? (
          <iframe src={doc.signed_url} title={title} className="document-preview__frame" />
        ) : (
          <img src={doc.signed_url} alt="" className="document-preview__image" />
        )}
      </div>

      <div className="document-preview__actions">
        {downloadFailed && <p className="form-error">{t("documentCapture.downloadError")}</p>}
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
