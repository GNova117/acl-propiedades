import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { useCompare } from "../context/CompareContext";
import { db } from "../lib/dataStore";
import { formatMXN, formatArea, propertyTypeLabel } from "../lib/format";
import "./Compare.css";

export default function Compare() {
  const { t } = useTranslation();
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Igual que /favoritos: cada id se resuelve por su cuenta (nunca son
    // más de 4), y una propiedad borrada después de agregarse a la
    // comparación simplemente desaparece de la tabla en vez de tronar.
    Promise.all(compareIds.map((id) => db.getPropertyById(id).catch(() => null))).then((results) => {
      if (active) {
        setProperties(results.filter(Boolean));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [compareIds]);

  const rows = [
    { label: t("compare.price"), render: (p) => formatMXN(p.price) },
    { label: t("properties.type"), render: (p) => propertyTypeLabel(t, p.type) },
    { label: t("properties.operationType"), render: (p) => (p.operation_type ? t(`propertyOperation.${p.operation_type}`) : "—") },
    { label: t("properties.zone"), render: (p) => p.zone || "—" },
    { label: t("properties.area"), render: (p) => formatArea(p.area_m2) },
    { label: t("properties.bedrooms"), render: (p) => (p.bedrooms != null ? p.bedrooms : "—") },
    { label: t("properties.bathrooms"), render: (p) => (p.bathrooms != null ? p.bathrooms : "—") },
    { label: t("compare.parking"), render: (p) => (p.parking != null ? p.parking : "—") },
    { label: t("common.status"), render: (p) => t(`propertyStatus.${p.status}`) },
  ];

  return (
    <>
      <Seo title={t("compare.title")} description={t("compare.subtitle")} />

      <div className="container properties-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h2>{t("compare.title")}</h2>
          <p>{t("compare.subtitle")}</p>
        </div>

        {loading ? (
          <div className="empty-state">{t("common.loading")}</div>
        ) : properties.length === 0 ? (
          <div className="empty-state">
            <p>{t("compare.empty")}</p>
            <Link to="/propiedades" className="btn btn-primary">
              {t("compare.browseCta")}
            </Link>
          </div>
        ) : (
          <>
            <div className="compare-table-wrapper">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th className="compare-table__row-label"></th>
                    {properties.map((property) => (
                      <th key={property.id}>
                        <div className="compare-table__column-head">
                          <img src={property.main_image} alt={property.title} />
                          <Link to={`/propiedades/${property.id}`}>{property.title}</Link>
                          {property.code && <span className="compare-table__code">{property.code}</span>}
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => removeFromCompare(property.id)}>
                            {t("compare.removeOne")}
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <th className="compare-table__row-label">{row.label}</th>
                      {properties.map((property) => (
                        <td key={property.id}>{row.render(property)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th className="compare-table__row-label"></th>
                    {properties.map((property) => (
                      <td key={property.id}>
                        <Link to={`/propiedades/${property.id}`} className="btn btn-primary btn-sm">
                          {t("properties.viewDetail")}
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-outline compare-page__clear" onClick={clearCompare}>
              {t("compare.clearAll")}
            </button>
          </>
        )}
      </div>
    </>
  );
}
