import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { DOC_TYPES, DOC_TYPE_ASPECT } from "../../lib/format";
import DocumentCapture from "../../components/DocumentCapture";
import "./admin.css";

export default function AdminClientDocuments() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capturingType, setCapturingType] = useState(null);

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

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteClientDocument(docId);
    load();
  };

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

      <div className="admin-doc-grid">
        {DOC_TYPES.map((docType) => {
          const docsOfType = documents.filter((d) => d.doc_type === docType);
          return (
            <div className="card admin-doc-card" key={docType}>
              <h3>{t(`documentCapture.docTypes.${docType}`)}</h3>

              {docsOfType.length === 0 ? (
                <p className="form-hint">{t("documentCapture.noDocuments")}</p>
              ) : (
                <div className="admin-doc-card__list">
                  {docsOfType.map((doc) => (
                    <div className="admin-doc-card__item" key={doc.id}>
                      <img src={doc.signed_url} alt="" />
                      <span className="form-hint">
                        {t("documentCapture.capturedAt")} {new Date(doc.captured_at).toLocaleString()}
                      </span>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="btn btn-primary btn-sm" onClick={() => setCapturingType(docType)}>
                {t("documentCapture.addDocument")}
              </button>
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
    </div>
  );
}
