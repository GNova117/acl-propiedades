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

// `fixedType`: apartado de un solo tipo (naves industriales, terrenos) — el
// filtro de Tipo no se muestra, ya está implícito en la sección, y el
// filtro de Operación tampoco (solo aplica en Propiedades, por ahora).
// `excludeTypes`: apartado general "/propiedades" — la lista de tipos
// seleccionables sale en vivo de property_types, menos los que ya tienen
// su propio apartado; un tipo nuevo que se agregue desde /admin/zonas cae
// aquí por default sin tocar código.
export default function Properties({ fixedType, excludeTypes = [], titleKey = "properties.title", subtitleKey = "properties.subtitle" }) {
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
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");

  useEffect(() => {
    db.getZones().then(setZones).catch(() => setZones([]));
    db.getPropertyTypes().then(setPropertyTypes).catch(() => setPropertyTypes([]));
  }, []);

  const sectionTypes = useMemo(() => {
    if (fixedType) return [fixedType];
    return propertyTypes.map((pt) => pt.key).filter((key) => !excludeTypes.includes(key));
  }, [fixedType, excludeTypes, propertyTypes]);

  // Con un solo tipo en la sección no tiene caso mostrar el filtro de Tipo.
  const typeOptions = fixedType ? [] : sectionTypes;

  const queryFilters = useMemo(
    () => ({
      activeOnly: true,
      type: fixedType || filters.type || undefined,
      types: fixedType || filters.type ? undefined : sectionTypes,
      operation_type: fixedType ? undefined : filters.operationType || undefined,
      zone: filters.zone || undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      minArea: filters.minArea ? Number(filters.minArea) : undefined,
      maxArea: filters.maxArea ? Number(filters.maxArea) : undefined,
    }),
    [filters, fixedType, sectionTypes]
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
              showOperation={!fixedType}
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
