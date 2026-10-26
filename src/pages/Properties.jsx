import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import PropertyFilters from "../components/PropertyFilters";
import PropertyCard from "../components/PropertyCard";
import Reveal from "../components/Reveal";
import AlertSignupCard from "../components/AlertSignupCard";
import { filtersToCriteria } from "../lib/alertMatch";
import { propertyMatchesCity } from "../lib/zoneLandingPages";
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

// Tamaño de página del listado: solo aplica a la vista de lista — la vista
// de mapa necesita todas las propiedades que cumplen el filtro para poner
// cada pin, así que esa sigue pidiendo el set completo.
const PAGE_SIZE = 24;

// Número de oficina — mismo que usa Contact.jsx/Footer.jsx/
// ChatWidget.jsx (cada uno lo tiene por separado, no hay una
// constante compartida en el proyecto todavía).
const OFFICE_WHATSAPP = "528713243271";

// CTA para cuando un listado queda vacío (sin resultados con los filtros
// actuales, o un apartado tipo Naves Industriales aún deshabilitado): sin
// esto la página era un callejón sin salida — solo el mensaje de "no hay
// nada", sin invitar a nada más.
function NotifyMeCta({ section }) {
  const { t } = useTranslation();
  const href = `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(t("properties.notifyMessage", { section }))}`;
  return (
    <p className="empty-state__cta">
      {t("properties.notifyLead")}{" "}
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
        {t("properties.notifyCta")}
      </a>
    </p>
  );
}

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
// `title`/`subtitle`: texto literal, tiene prioridad sobre `titleKey`/
// `subtitleKey` — lo usan las páginas de aterrizaje por ciudad (ZoneLanding),
// donde el título depende del nombre de la ciudad y no puede ser una llave
// fija de i18n.
// `headerExtra`: contenido opcional bajo el título (ZoneLanding pone ahí la
// franja de mercado de la ciudad).
// `cityFilter`: filtro adicional por ciudad (ZoneLanding) aplicado en el
// cliente sobre zona+dirección. No puede resolverse en queryFilters como el
// resto de los filtros porque el filtro de `zone` del backend exige
// coincidencia exacta contra el nombre de colonia (admin/zonas), no contra
// el nombre de la ciudad.
export default function Properties({
  fixedType,
  excludeTypes = NO_EXCLUDED_TYPES,
  titleKey = "properties.title",
  subtitleKey = "properties.subtitle",
  title,
  subtitle,
  headerExtra,
  cityFilter,
}) {
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");

  // Cualquier cambio de filtro o de orden deja resultados viejos de otra
  // búsqueda en la página 2+; se regresa a la primera página para no
  // mostrar un vacío falso ("sin resultados") solo porque esa búsqueda
  // nueva no llega tan lejos.
  const goToFilters = (updater) => {
    setPage(0);
    setFilters(updater);
  };

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

  // Sin ningún filtro puesto, un listado vacío no es "no hay nada con esos
  // filtros" sino "este apartado no tiene nada publicado" — decirle lo
  // primero a alguien que ni tocó los filtros confunde (pasaba en Terrenos).
  const hasActiveFilters = Object.keys(EMPTY_FILTERS).some((key) =>
    key === "sortBy" ? false : Array.isArray(filters[key]) ? filters[key].length > 0 : Boolean(filters[key])
  );

  // Criterios de la alerta de búsqueda = los filtros que la persona tiene puestos.
  const alertCriteria = useMemo(() => filtersToCriteria(filters, { fixedType }), [filters, fixedType]);

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
    // La vista de mapa necesita el set completo (cada propiedad es un pin).
    // `cityFilter` (páginas de ZoneLanding) también: es un filtro que se
    // resuelve en el cliente —no es una `zone` exacta, sino cualquier
    // colonia de esa ciudad— así que no se le puede pedir al backend que
    // pagine algo que todavía no sabe si va a quedar en el resultado. Solo
    // la lista normal, sin cityFilter, pide su página directo al servidor.
    const needsFullSet = view === "map" || Boolean(cityFilter);
    const request = needsFullSet
      ? db.getProperties(queryFilters).then((data) => {
          const filtered = cityFilter ? data.filter((property) => propertyMatchesCity(property, cityFilter)) : data;
          return view === "map"
            ? { data: filtered, total: filtered.length }
            : { data: filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), total: filtered.length };
        })
      : db.getProperties({ ...queryFilters, page, pageSize: PAGE_SIZE });
    request
      .then(({ data, total: count }) => {
        if (!active) return;
        setProperties(data);
        setTotal(count);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [queryFilters, view, page, cityFilter]);

  const pageTitle = title || t(titleKey);
  const pageSubtitle = subtitle || t(subtitleKey);

  if (sectionDisabled) {
    return (
      <>
        <Seo title={pageTitle} description={pageSubtitle} />
        <div className="container properties-page">
          <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
            <h2>{pageTitle}</h2>
          </div>
          <div className="empty-state">
            {t("properties.comingSoon")}
            <NotifyMeCta section={pageTitle} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title={pageTitle} description={pageSubtitle} />

      <div className="container properties-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h2>{pageTitle}</h2>
          <p>{pageSubtitle}</p>
        </div>

        {headerExtra}

        <div className="properties-page__layout">
          <aside>
            <PropertyFilters
              filters={filters}
              zones={zones}
              typeOptions={typeOptions}
              showOperation={!fixedType}
              showNaveTipo={fixedType === "nave_industrial"}
              showHomeFilters={fixedType !== "terreno"}
              onChange={goToFilters}
              onClear={() => goToFilters(EMPTY_FILTERS)}
            />
          </aside>

          <div className="properties-page__results">
            <div className="properties-page__toolbar">
              <span>{t(total === 1 ? "properties.results_one" : "properties.results_other", { count: total })}</span>
              <div className="properties-page__toolbar-actions">
                <select
                  aria-label={t("properties.sortBy")}
                  value={filters.sortBy}
                  onChange={(e) => goToFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
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
            ) : total === 0 ? (
              <div className="empty-state">
                {t(hasActiveFilters ? "properties.noResults" : "properties.emptySection")}
                <NotifyMeCta section={pageTitle} />
              </div>
            ) : view === "map" ? (
              <Suspense fallback={<div className="empty-state" style={{ height: 560 }}>{t("common.loading")}</div>}>
                <PropertyMap properties={properties} height={560} />
              </Suspense>
            ) : (
              <>
                <div className="properties-grid">
                  {properties.map((property, index) => (
                    <Reveal key={property.id} delay={(index % 6) * 70}>
                      <PropertyCard property={property} />
                    </Reveal>
                  ))}
                </div>
                {total > PAGE_SIZE && (
                  <div className="properties-page__pagination">
                    <button type="button" className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      {t("properties.prevPage")}
                    </button>
                    <span>{t("properties.pageOf", { page: page + 1, pages: Math.ceil(total / PAGE_SIZE) })}</span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("properties.nextPage")}
                    </button>
                  </div>
                )}
              </>
            )}
            {!loading && (
              <AlertSignupCard
                mode="search"
                criteria={alertCriteria}
                matchCount={total}
                key={JSON.stringify(alertCriteria)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
