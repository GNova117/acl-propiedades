import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { MAX_COMPARE, useCompare } from "../context/useCompare.js";
import { formatMXN, formatArea, propertyTypeLabel } from "../lib/format";
import "./Compare.css";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { propertyPath } from "../lib/propertyUrl.js";
import { loadPropertiesInOrder } from "../lib/propertiesByIds";
import { estimateMonthlyPayment } from "../lib/monthlyEstimate";
import { siteOrigin } from "../lib/site";
import { copyFallback } from "../lib/toast";

// Precio por m² de una propiedad (null si no hay superficie).
const pricePerM2 = (p) => (Number(p.area_m2) > 0 && Number(p.price) > 0 ? Math.round(Number(p.price) / Number(p.area_m2)) : null);

export default function Compare() {
  const { t } = useTranslation();
  const { compareIds: ownIds, removeFromCompare, clearCompare } = useCompare();
  // Una comparación se comparte por enlace (/comparar?ids=a,b,c): quien lo abre la ve sin haber marcado nada.
  const [searchParams] = useSearchParams();
  const sharedIds = useMemo(() => (searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, MAX_COMPARE), [searchParams]);
  const shared = sharedIds.length > 0;
  const compareIds = shared ? sharedIds : ownIds;
  const [copied, setCopied] = useState(false);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Igual que /favoritos: cada id se resuelve por su cuenta (nunca son
    // más de 4), y una propiedad borrada después de agregarse a la
    // comparación simplemente desaparece de la tabla en vez de tronar.
    loadPropertiesInOrder(compareIds).then((results) => {
      if (active) {
        setProperties(results);
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
    // Lo que de verdad permite comparar: precio por m² y pago mensual estimado (en ventas); resaltado el más bajo.
    { label: t("compare.pricePerM2"), render: (p) => (pricePerM2(p) ? formatMXN(pricePerM2(p)) : "—"), best: (p) => pricePerM2(p) },
    { label: t("compare.monthly"), render: (p) => (estimateMonthlyPayment(p) ? formatMXN(estimateMonthlyPayment(p).payment) : "—"), best: (p) => estimateMonthlyPayment(p)?.payment || null },
    { label: t("properties.bedrooms"), render: (p) => (p.bedrooms != null ? p.bedrooms : "—") },
    { label: t("properties.bathrooms"), render: (p) => (p.bathrooms != null ? p.bathrooms : "—") },
    { label: t("compare.parking"), render: (p) => (p.parking != null ? p.parking : "—") },
    { label: t("common.status"), render: (p) => t(`propertyStatus.${p.status}`) },
  ];

  return (
    <>
      <Seo title={t("compare.title")} description={t("compare.subtitle")} noindex />

      <div className="container properties-page">
        <div className="section-heading m-section">
          <h1>{t("compare.title")}</h1>
          <p>{t("compare.subtitle")}</p>
        </div>

        {loading ? (
          <LoadingState />
        ) : properties.length === 0 ? (
          <EmptyState illustration="compare" title={t("emptyState.compareTitle")} text={t("compare.empty")}>
            <Link to="/propiedades" className="btn btn-primary">
              {t("compare.browseCta")}
            </Link>
          </EmptyState>
        ) : (
          <>
            <div className="compare-table-wrapper">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th className="compare-table__row-label"><span className="visually-hidden-cell">{t("compare.feature")}</span></th>
                    {properties.map((property) => (
                      <th key={property.id}>
                        <div className="compare-table__column-head">
                          {property.main_image && <img src={property.main_image} alt={property.title} loading="lazy" decoding="async" />}
                          <Link to={propertyPath(property)}>{property.title}</Link>
                          {property.code && <span className="compare-table__code">{property.code}</span>}
                          {!shared && (
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => removeFromCompare(property.id)}>
                              {t("compare.removeOne")}
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <th className="compare-table__row-label">{row.label}</th>
                      {properties.map((property) => {
                        const values = row.best ? properties.map(row.best).filter((v) => v != null) : [];
                        const mine = row.best ? row.best(property) : null;
                        const isBest = row.best && values.length > 1 && mine != null && mine === Math.min(...values);
                        return (
                          <td key={property.id} className={isBest ? "compare-table__best" : undefined}>
                            {row.render(property)}
                            {isBest && <span className="visually-hidden"> ({t("compare.bestValue")})</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th className="compare-table__row-label"><span className="visually-hidden-cell">{t("common.actions")}</span></th>
                    {properties.map((property) => (
                      <td key={property.id}>
                        <Link to={propertyPath(property)} className="btn btn-primary btn-sm">
                          {t("properties.viewDetail")}
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="compare-page__actions">
              {shared ? (
                <Link to="/propiedades" className="btn btn-outline">
                  {t("compare.browseCta")}
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      const link = `${siteOrigin()}/comparar?ids=${ownIds.join(",")}`;
                      try {
                        await navigator.clipboard.writeText(link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        copyFallback(t("compare.copyManual"), link);
                      }
                    }}
                  >
                    {copied ? t("compare.copied") : t("compare.share")}
                  </button>
                  <button type="button" className="btn btn-outline compare-page__clear" onClick={clearCompare}>
                    {t("compare.clearAll")}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
