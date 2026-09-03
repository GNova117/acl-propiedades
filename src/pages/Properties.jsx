import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import PropertyFilters from "../components/PropertyFilters";
import PropertyCard from "../components/PropertyCard";
import PropertyMap from "../components/PropertyMap";
import { db } from "../lib/dataStore";
import "./Properties.css";

const EMPTY_FILTERS = { type: "", operationType: "", zone: "", minPrice: "", maxPrice: "", minArea: "", maxArea: "" };

export default function Properties({ allowedTypes, titleKey = "properties.title", subtitleKey = "properties.subtitle" }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    type: searchParams.get("tipo") || "",
    zone: searchParams.get("zona") || "",
    minPrice: searchParams.get("min") || "",
    maxPrice: searchParams.get("max") || "",
  });
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");

  useEffect(() => {
    db.getZones().then(setZones).catch(() => setZones([]));
  }, []);

  // Cuando el apartado solo tiene un tipo (naves industriales, terrenos) no
  // tiene caso mostrar el filtro de Tipo — ya está implícito en la sección.
  const typeOptions = allowedTypes.length > 1 ? allowedTypes : [];

  const queryFilters = useMemo(
    () => ({
      activeOnly: true,
      type: filters.type || undefined,
      types: filters.type ? undefined : allowedTypes,
      operation_type: filters.operationType || undefined,
      zone: filters.zone || undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      minArea: filters.minArea ? Number(filters.minArea) : undefined,
      maxArea: filters.maxArea ? Number(filters.maxArea) : undefined,
    }),
    [filters, allowedTypes]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.getProperties(queryFilters)
      .then((data) => active && setProperties(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [queryFilters]);

  return (
    <>
      <Seo title={t(titleKey)} description={t(subtitleKey)} />

      <div className="container properties-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h2>{t(titleKey)}</h2>
          <p>{t(subtitleKey)}</p>
        </div>

        <div className="properties-page__layout">
          <aside>
            <PropertyFilters
              filters={filters}
              zones={zones}
              typeOptions={typeOptions}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_FILTERS)}
            />
          </aside>

          <div className="properties-page__results">
            <div className="properties-page__toolbar">
              <span>{t(properties.length === 1 ? "properties.results_one" : "properties.results_other", { count: properties.length })}</span>
              <div className="properties-page__view-toggle">
                <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
                  {t("properties.listView")}
                </button>
                <button type="button" className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
                  {t("properties.mapView")}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">{t("common.loading")}</div>
            ) : properties.length === 0 ? (
              <div className="empty-state">{t("properties.noResults")}</div>
            ) : view === "map" ? (
              <PropertyMap properties={properties} height={560} />
            ) : (
              <div className="properties-grid">
                {properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
