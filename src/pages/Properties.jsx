import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import PropertyFilters from "../components/PropertyFilters";
import PropertyCard from "../components/PropertyCard";
import Reveal from "../components/Reveal";
import { db } from "../lib/dataStore";
import "./Properties.css";

// Leaflet (react-leaflet + leaflet, ~150KB) pesa bastante para algo que
// la mayoría de las visitas nunca activa (por default se ve la lista, no
// el mapa) — cargarlo solo cuando alguien de verdad le da a "Ver en
// mapa" saca ese peso del bundle principal del sitio público.
const PropertyMap = lazy(() => import("../components/PropertyMap"));

const EMPTY_FILTERS = {
  type: "",
  operationType: "",
  tipoNave: "",
  zone: "",
  minPrice: "",
  maxPrice: "",
  minArea: "",
  maxArea: "",
  minBedrooms: "",
  minBathrooms: "",
  minParking: "",
  amenities: [],
  sortBy: "newest",
};

const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "area_desc"];

// Referencia estable para el default de `excludeTypes`: un `= []` inline en
// la firma de la función crea un arreglo nuevo en cada render, lo que
// invalidaba el useMemo de queryFilters en cada pasada y disparaba un
// fetch en loop infinito en /naves-industriales y /terrenos (no se notaba
// en modo demo local porque el backend local resuelve casi instantáneo;
// contra Supabase real sí quedaba pegado en "Cargando...").
const NO_EXCLUDED_TYPES = [];

// `fixedType`: apartado de un solo tipo (naves industriales, terrenos) — el
// filtro de Tipo no se muestra, ya está implícito en la sección, y el
// filtro de Operación tampoco (solo aplica en Propiedades, por ahora).
// `excludeTypes`: apartado general "/propiedades" — la lista de tipos
// seleccionables sale en vivo de property_types, menos los que ya tienen
// su propio apartado; un tipo nuevo que se agregue desde /admin/zonas cae
// aquí por default sin tocar código.
export default function Properties({ fixedType, excludeTypes = NO_EXCLUDED_TYPES, titleKey = "properties.title", subtitleKey = "properties.subtitle" }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    type: searchParams.get("tipo") || "",
    operationType: searchParams.get("operacion") || "",
    tipoNave: searchParams.get("navetipo") || "",
    zone: searchParams.get("zona") || "",
    minPrice: searchParams.get("min") || "",
    maxPrice: searchParams.get("max") || "",
    minArea: searchParams.get("minm2") || "",
    maxArea: searchParams.get("maxm2") || "",
    minBedrooms: searchParams.get("recamaras") || "",
    minBathrooms: searchParams.get("banos") || "",
    minParking: searchParams.get("estacionamiento") || "",
    amenities: searchParams.get("amenidades")?.split(",").filter(Boolean) || [],
    sortBy: searchParams.get("orden") || "newest",
  });
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");

  useEffect(() => {
    db.getZones().then(setZones).catch(() => setZones([]));
    db.getPropertyTypes()
      .then(setPropertyTypes)
      .catch(() => setPropertyTypes([]))
      .finally(() => setTypesLoaded(true));
  }, []);

  // Refleja los filtros en la URL en cada cambio — antes solo se leían al
  // cargar y nunca se volvían a escribir, así que "Volver" desde una ficha
  // reiniciaba la búsqueda. `replace: true` evita ensuciar el historial en
  // cada tecleo: cada ajuste de filtro pisa la misma entrada, y es esa
  // entrada (con el filtro ya actualizado) la que "Volver" restaura.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.type) params.set("tipo", filters.type);
    if (filters.operationType) params.set("operacion", filters.operationType);
    if (filters.tipoNave) params.set("navetipo", filters.tipoNave);
    if (filters.zone) params.set("zona", filters.zone);
    if (filters.minPrice) params.set("min", filters.minPrice);
    if (filters.maxPrice) params.set("max", filters.maxPrice);
    if (filters.minArea) params.set("minm2", filters.minArea);
    if (filters.maxArea) params.set("maxm2", filters.maxArea);
    if (filters.minBedrooms) params.set("recamaras", filters.minBedrooms);
    if (filters.minBathrooms) params.set("banos", filters.minBathrooms);
    if (filters.minParking) params.set("estacionamiento", filters.minParking);
    if (filters.amenities.length) params.set("amenidades", filters.amenities.join(","));
    if (filters.sortBy && filters.sortBy !== "newest") params.set("orden", filters.sortBy);
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Apartado dedicado a un tipo desactivado desde /admin/zonas (Naves
  // Industriales/Terrenos hoy) — se muestra "Próximamente" en vez del
  // listado vacío, por si alguien llega directo a la URL sin pasar por el
  // menú (que ya lo oculta) o la tarjeta del inicio (que ya avisa).
  const sectionDisabled = fixedType && typesLoaded && propertyTypes.some((pt) => pt.key === fixedType && pt.active === false);

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
      tipo_nave: fixedType === "nave_industrial" ? filters.tipoNave || undefined : undefined,
      zone: filters.zone || undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      minArea: filters.minArea ? Number(filters.minArea) : undefined,
      maxArea: filters.maxArea ? Number(filters.maxArea) : undefined,
      minBedrooms: filters.minBedrooms ? Number(filters.minBedrooms) : undefined,
      minBathrooms: filters.minBathrooms ? Number(filters.minBathrooms) : undefined,
      minParking: filters.minParking ? Number(filters.minParking) : undefined,
      amenities: filters.amenities.length ? filters.amenities : undefined,
      sortBy: filters.sortBy,
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

  if (sectionDisabled) {
    return (
      <>
        <Seo title={t(titleKey)} description={t(subtitleKey)} />
        <div className="container properties-page">
          <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
            <h2>{t(titleKey)}</h2>
          </div>
          <div className="empty-state">{t("properties.comingSoon")}</div>
        </div>
      </>
    );
  }

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
              showNaveTipo={fixedType === "nave_industrial"}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_FILTERS)}
            />
          </aside>

          <div className="properties-page__results">
            <div className="properties-page__toolbar">
              <span>{t(properties.length === 1 ? "properties.results_one" : "properties.results_other", { count: properties.length })}</span>
              <div className="properties-page__toolbar-actions">
                <select
                  aria-label={t("properties.sortBy")}
                  value={filters.sortBy}
                  onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`properties.sort.${option}`)}
                    </option>
                  ))}
                </select>
                <div className="properties-page__view-toggle">
                  <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
                    {t("properties.listView")}
                  </button>
                  <button type="button" className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
                    {t("properties.mapView")}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">{t("common.loading")}</div>
            ) : properties.length === 0 ? (
              <div className="empty-state">{t("properties.noResults")}</div>
            ) : view === "map" ? (
              <Suspense fallback={<div className="empty-state" style={{ height: 560 }}>{t("common.loading")}</div>}>
                <PropertyMap properties={properties} height={560} />
              </Suspense>
            ) : (
              <div className="properties-grid">
                {properties.map((property, index) => (
                  <Reveal key={property.id} delay={(index % 6) * 70}>
                    <PropertyCard property={property} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
