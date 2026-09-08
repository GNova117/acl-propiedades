import { useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadLegalDocPdf } from "../../lib/legalDocsPdf";
import "./admin.css";

// Descarga el Aviso de Privacidad / Carta de Derechos sobre la hoja
// membretada, con línea de firma — el texto es el mismo que ya se publica
// en /aviso-de-privacidad y /carta-de-derechos, tomado en vivo de i18n para
// no tener dos copias del mismo contenido legal.
export default function AdminLegalDocs() {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(null);

  const handleDownload = async (key, filePrefix) => {
    setDownloading(key);
    try {
      const content = t(key, { returnObjects: true });
      await downloadLegalDocPdf(content, filePrefix);
    } catch (err) {
      window.alert(err.message || "Error al generar el documento");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("legalDocs.title")}</h1>
      </div>
      <p className="form-hint" style={{ marginBottom: "1.5rem" }}>{t("legalDocs.subtitle")}</p>

      <div className="admin-zones-grid">
        <div className="card admin-zone-card">
          <h3>{t("privacy.title")}</h3>
          <p className="form-hint">{t("legalDocs.privacyHint")}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDownload("privacy", "Aviso_Privacidad")} disabled={downloading === "privacy"}>
            {downloading === "privacy" ? <span className="spinner" /> : null}
            {t("legalDocs.download")}
          </button>
        </div>
        <div className="card admin-zone-card">
          <h3>{t("rights.title")}</h3>
          <p className="form-hint">{t("legalDocs.rightsHint")}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDownload("rights", "Carta_Derechos")} disabled={downloading === "rights"}>
            {downloading === "rights" ? <span className="spinner" /> : null}
            {t("legalDocs.download")}
          </button>
        </div>
      </div>
    </div>
  );
}
