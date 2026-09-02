import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, formatArea } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

export default function AdminProperties() {
  const { t } = useTranslation();
  const { isPartner } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    db.getProperties({}).then((data) => {
      setProperties(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteProperty(id);
    load();
  };

  const toggleActive = async (property) => {
    await db.updateProperty(property.id, { ...property, active: !property.active, imageFiles: [], existingImages: property.images });
    load();
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.properties")}</h1>
        <Link to="/admin/propiedades/nueva" className="btn btn-primary">
          {t("admin.newProperty")}
        </Link>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Título</th>
              <th>{t("properties.type")}</th>
              <th>{t("properties.zone")}</th>
              <th>Precio</th>
              <th>{t("properties.area")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.active")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>{t("common.loading")}</td></tr>
            ) : properties.length === 0 ? (
              <tr><td colSpan={9}>{t("properties.noResults")}</td></tr>
            ) : (
              properties.map((property) => (
                <tr key={property.id}>
                  <td><img src={property.main_image} alt="" /></td>
                  <td>{property.title}</td>
                  <td>{t(`propertyType.${property.type}`)}</td>
                  <td>{property.zone}</td>
                  <td>{formatMXN(property.price)}</td>
                  <td>{formatArea(property.area_m2)}</td>
                  <td>{t(`propertyStatus.${property.status}`)}</td>
                  <td>
                    <button type="button" className={`badge ${property.active ? "badge-available" : "badge-sold"}`} onClick={() => toggleActive(property)}>
                      {property.active ? t("common.active") : t("common.inactive")}
                    </button>
                  </td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/propiedades/${property.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    {isPartner && (
                      <Link to={`/admin/propiedades/${property.id}/liquidacion`} className="btn btn-outline btn-sm">
                        {t("liquidacion.button")}
                      </Link>
                    )}
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(property.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
