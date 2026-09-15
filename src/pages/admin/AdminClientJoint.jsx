import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { DOC_TYPES, isPdfDoc } from "../../lib/format";
import { downloadClientDocumentAsPdf } from "../../lib/clientDocPdf";
import DocumentPreviewModal from "../../components/DocumentPreviewModal";
import "./admin.css";

function clientTypeLabel(t, type) {
  return t(`clients.${type === "comprador" ? "buyer" : type === "vendedor" ? "seller" : "both"}`);
}

// Vista de solo lectura del expediente conjunto — cada cliente sigue
// siendo su propio registro con su propio perfilamiento/documentos (esos
// se siguen capturando desde la ficha de cada quien, no desde aquí); esta
// pantalla solo junta lo ya capturado de ambos para no tener que brincar
// entre dos fichas separadas al revisar un caso como un crédito
// INFONAVIT conyugal.
export default function AdminClientJoint() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState(null);
  const [clientA, setClientA] = useState(null);
  const [clientB, setClientB] = useState(null);
  const [docsA, setDocsA] = useState([]);
  const [docsB, setDocsB] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrorId, setDownloadErrorId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.getClientLink(id).then(async (foundLink) => {
      if (!active) return;
      if (!foundLink) {
        setLink(null);
        setLoading(false);
        return;
      }
      setLink(foundLink);
      const otherId = foundLink.other_client?.id;
      const [self, other, selfDocs, otherDocs] = await Promise.all([
        db.getClientById(id),
        otherId ? db.getClientById(otherId) : Promise.resolve(null),
        db.getClientDocuments(id),
        otherId ? db.getClientDocuments(otherId) : Promise.resolve([]),
      ]);
      if (!active) return;
      setClientA(self);
      setClientB(other);
      setDocsA(selfDocs);
      setDocsB(otherDocs);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    setDownloadErrorId(null);
    try {
      await downloadClientDocumentAsPdf(doc, `${doc.owner?.name || "cliente"}_${doc.doc_type}`);
    } catch {
      setDownloadErrorId(doc.id);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  if (!link || !clientA || !clientB) {
    return (
      <div>
        <div className="admin-header">
          <h1>{t("clients.jointHeading")}</h1>
          <Link to={`/admin/clientes/${id}`} className="btn btn-outline">
            {t("clients.jointBackToClient")}
          </Link>
        </div>
        <div className="empty-state">{t("clients.jointNoLink")}</div>
      </div>
    );
  }

  const people = [clientA, clientB];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("clients.jointHeading")}</h1>
          <p className="form-hint">
            {clientA.name} + {clientB.name}
            {link.label ? ` · ${link.label}` : ""}
          </p>
        </div>
        <Link to={`/admin/clientes/${id}`} className="btn btn-outline">
          {t("clients.jointBackToClient")}
        </Link>
      </div>

      <div className="admin-dashboard-panels" style={{ marginBottom: "1.5rem" }}>
        {people.map((person) => (
          <div className="card admin-dashboard-panel" key={person.id}>
            <div className="admin-dashboard-panel__header">
              <h2>{person.name}</h2>
              <Link to={`/admin/clientes/${person.id}`} className="btn btn-outline btn-sm">
                {t("common.edit")}
              </Link>
            </div>
            <p className="form-hint" style={{ marginTop: 0 }}>{clientTypeLabel(t, person.type)}</p>
            <p style={{ margin: "0.2rem 0" }}>{person.phone || "—"}</p>
            <p style={{ margin: "0.2rem 0" }}>{person.email || "—"}</p>
            <div className="admin-form__actions" style={{ marginTop: "0.75rem" }}>
              <Link to={`/admin/clientes/${person.id}/perfilamiento`} className="btn btn-outline btn-sm">
                {t("profiling.title")}
              </Link>
              <Link to={`/admin/clientes/${person.id}/documentos`} className="btn btn-outline btn-sm">
                {t("clients.viewDocuments")}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <h3>{t("clients.jointDocuments")}</h3>
      <div className="admin-doc-grid">
        {DOC_TYPES.map((docType) => {
          const itemsA = docsA.filter((d) => d.doc_type === docType).map((d) => ({ ...d, owner: clientA }));
          const itemsB = docsB.filter((d) => d.doc_type === docType).map((d) => ({ ...d, owner: clientB }));
          const items = [...itemsA, ...itemsB];
          return (
            <div className="card admin-doc-card" key={docType}>
              <h3>{t(`documentCapture.docTypes.${docType}`)}</h3>
              {items.length === 0 ? (
                <p className="form-hint">{t("documentCapture.noDocuments")}</p>
              ) : (
                <div className="admin-doc-card__list">
                  {items.map((doc) => (
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
                      <span className="form-hint">{doc.owner.name}</span>
                      {downloadErrorId === doc.id && <p className="form-error">{t("documentCapture.downloadError")}</p>}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          title={t(`documentCapture.docTypes.${previewDoc.doc_type}`)}
          subtitle={previewDoc.owner?.name}
          filePrefix={`${previewDoc.owner?.name || "cliente"}_${previewDoc.doc_type}`}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
