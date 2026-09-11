import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN } from "../../lib/format";
import "./admin.css";

const FIELD_LABELS = { price: "Precio", status: "Estatus" };

function formatValue(field, value, t) {
  if (value == null) return "—";
  if (field === "price") return formatMXN(Number(value));
  if (field === "status") return t(`propertyStatus.${value}`, value);
  return value;
}

export default function AdminPropertyHistory({ listPath = "/admin/propiedades" }) {
  const { id } = useParams();
  const { t } = useTranslation();
  const [property, setProperty] = useState(null);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([db.getPropertyById(id), db.getPropertyChanges(id)]).then(([propertyData, changeData]) => {
      setProperty(propertyData);
      setChanges(changeData);
      setLoading(false);
    });
  }, [id]);

  return (
    <div>
      <div className="admin-header">
        <h1>{t("propertyHistory.title")}{property ? ` — ${property.title}` : ""}</h1>
        <Link to={listPath} className="btn btn-outline">
          {t("detail.back")}
        </Link>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("messages.date")}</th>
              <th>{t("propertyHistory.field")}</th>
              <th>{t("propertyHistory.before")}</th>
              <th>{t("propertyHistory.after")}</th>
              <th>{t("propertyHistory.changedBy")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>{t("common.loading")}</td></tr>
            ) : changes.length === 0 ? (
              <tr><td colSpan={5}>{t("propertyHistory.noResults")}</td></tr>
            ) : (
              changes.map((change) => (
                <tr key={change.id}>
                  <td>{new Date(change.created_at).toLocaleString("es-MX")}</td>
                  <td>{FIELD_LABELS[change.field] || change.field}</td>
                  <td>{formatValue(change.field, change.old_value, t)}</td>
                  <td>{formatValue(change.field, change.new_value, t)}</td>
                  <td>{change.changed_by || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
