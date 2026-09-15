import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { DOC_TYPES, DOC_TYPE_ASPECT, isPdfDoc } from "../../lib/format";
import { downloadClientDocumentAsPdf } from "../../lib/clientDocPdf";
import DocumentCapture from "../../components/DocumentCapture";
import DocumentPreviewModal from "../../components/DocumentPreviewModal";
import "./admin.css";

export default function AdminClientDocuments() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capturingType, setCapturingType] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrorId, setDownloadErrorId] = useState(null);
  const [downloadErrorDetail, setDownloadErrorDetail] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([db.getClientById(id), db.getClientDocuments(id)]).then(([clientData, docs]) => {
      setClient(clientData);
      setDocuments(docs);
      setLoading(false);
    });
  };

  useEffect(load, [id]);

  const handleAccept = async ({ blob, qualityMetrics }) => {
    await db.addClientDocument({ client_id: id, doc_type: capturingType, blob, quality_metrics: qualityMetrics });
    setCapturingType(null);
    load();
  };

  // Un PDF ya existente se sube tal cual, sin pasar por la cámara ni por
  // el análisis de nitidez/brillo de DocumentCapture.jsx — ese análisis es
  // de imagen, no aplica a un PDF.
  const handlePdfUpload = async (docType, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await db.addClientDocument({ client_id: id, doc_type: docType, blob: file, quality_metrics: {} });
    load();
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteClientDocument(docId);
    load();
  };

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    setDownloadErrorId(null);
    try {
      await downloadClientDocumentAsPdf(doc, `${client?.name || "cliente"}_${doc.doc_type}`);
    } catch (err) {
      console.error("downloadClientDocumentAsPdf", err);
      setDownloadErrorId(doc.id);
      setDownloadErrorDetail(err?.message || String(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const months = t("dateFilter.months", { returnObjects: true });

  const years = useMemo(() => {
    const set = new Set(documents.filter((d) => d.captured_at).map((d) => new Date(d.captured_at).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (!monthFilter && !yearFilter) return documents;
    return documents.filter((d) => {
      if (!d.captured_at) return false;
      const date = new Date(d.captured_at);
      if (monthFilter && date.getMonth() + 1 !== Number(monthFilter)) return false;
      if (yearFilter && date.getFullYear() !== Number(yearFilter)) return false;
      return true;
    });
  }, [documents, monthFilter, yearFilter]);

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("admin.clientDocuments")}</h1>
          <p className="form-hint">{client?.name}</p>
        </div>
        <Link to={`/admin/clientes/${id}`} className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>

      <div className="form-row" style={{ maxWidth: 480, marginBottom: "1.25rem" }}>
        <div className="form-field">
          <label htmlFor="doc-month-filter">{t("dateFilter.month")}</label>
          <select id="doc-month-filter" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">{t("dateFilter.allMonths")}</option>
            {months.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="doc-year-filter">{t("dateFilter.year")}</label>
          <select id="doc-year-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">{t("dateFilter.allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-doc-grid">
        {DOC_TYPES.map((docType) => {
          const docsOfType = filteredDocuments.filter((d) => d.doc_type === docType);
          return (
            <div className="card admin-doc-card" key={docType}>
              <h3>{t(`documentCapture.docTypes.${docType}`)}</h3>

              {docsOfType.length === 0 ? (
                <p className="form-hint">{t("documentCapture.noDocuments")}</p>
              ) : (
                <div className="admin-doc-card__list">
                  {docsOfType.map((doc) => (
                    <div className="admin-doc-card__item" key={doc.id}>
                      {isPdfDoc(doc) ? (
                        <button type="button" className="admin-doc-card__pdf" onClick={() => setPreviewDoc(doc)}>
                          📄 {t("documentCapture.viewPdf")}
                        </button>
                      ) : (
                        <button type="button" className="admin-doc-card__thumb" onClick={() => setPreviewDoc(doc)}>
                          <img src={doc.signed_url} alt="" />
                        </button>
                      )}
                      <span className="form-hint">
                        {t("documentCapture.capturedAt")} {new Date(doc.captured_at).toLocaleString()}
                      </span>
                      {downloadErrorId === doc.id && (
                        <p className="form-error">
                          {t("documentCapture.downloadError")} ({downloadErrorDetail})
                        </p>
                      )}
                      <div className="admin-doc-card__item-actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                        >
                          {downloadingId === doc.id ? <span className="spinner" /> : null}
                          {t("documentCapture.downloadPdf")}
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="admin-doc-card__actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setCapturingType(docType)}>
                  {t("documentCapture.addDocument")}
                </button>
                <label className="btn btn-outline btn-sm">
                  <input type="file" accept="application/pdf" hidden onChange={(e) => handlePdfUpload(docType, e)} />
                  {t("documentCapture.uploadPdf")}
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {capturingType && (
        <DocumentCapture
          docType={capturingType}
          aspectRatio={DOC_TYPE_ASPECT[capturingType]}
          onAccept={handleAccept}
          onCancel={() => setCapturingType(null)}
        />
      )}

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          title={t(`documentCapture.docTypes.${previewDoc.doc_type}`)}
          subtitle={client?.name}
          filePrefix={`${client?.name || "cliente"}_${previewDoc.doc_type}`}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
