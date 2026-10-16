import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

export default function AdminDocumentTemplates() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    db.getDocumentTemplates().then((data) => {
      setTemplates(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (template) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingId(template.id);
    try {
      await db.deleteDocumentTemplate(template.id);
      load();
    } catch (err) {
      window.alert(err.message || t("documentTemplates.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("documentTemplates.title")}</h1>
          <p className="form-hint">{t("documentTemplates.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          <Link to="/admin/documentos-legales" className="btn btn-outline">
            {t("documentTemplates.backToLegalDocs")}
          </Link>
          <Link to="/admin/plantillas-documentos/nueva" className="btn btn-primary">
            {t("documentTemplates.new")}
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="form-hint">{t("common.loading")}</p>
      ) : templates.length === 0 ? (
        <p className="form-hint">{t("documentTemplates.empty")}</p>
      ) : (
        <div className="card admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("documentTemplates.fields.name")}</th>
                <th>{t("documentTemplates.fields.customFieldsCount")}</th>
                <th>{t("documentTemplates.fields.requiresSignatures")}</th>
                <th>{t("common.active")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{(template.custom_fields || []).length}</td>
                  <td>{template.requires_signatures ? t("documentTemplates.yes") : t("documentTemplates.no")}</td>
                  <td>
                    <span className={`badge ${template.active ? "badge-available" : "badge-sold"}`}>
                      {template.active ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/plantillas-documentos/${template.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(template)} disabled={deletingId === template.id}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
