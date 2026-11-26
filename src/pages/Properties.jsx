import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigationType, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import PropertyFilters from "../components/PropertyFilters";
import PropertyCard from "../components/PropertyCard";
import AlertSignupCard from "../components/AlertSignupCard";
import DevelopmentCard from "../components/DevelopmentCard";
import { filtersToCriteria } from "../lib/alertMatch";
import { buildActiveFilterChips } from "../lib/activeFilters";
import { boundsFromParam, boundsToParam } from "../lib/propertySearch";
import { propertyTypeLabel } from "../lib/format";
import { indexNextSlots } from "../lib/nextVisit";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { propertyMatchesCity } from "../lib/zoneLandingPages";
import { db } from "../lib/dataStore";
import "./Properties.css";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { OFFICE_WHATSAPP } from "../lib/office";

// Leaflet (react-leaflet + leaflet, ~150KB) pesa bastante para algo que
// la mayoría de las visitas nunca activa (por default se ve la lista, no
// el mapa) — cargarlo solo cuando alguien de verdad le da a "Ver en
// mapa" saca ese peso del bundle principal del sitio público.
const PropertyMap = lazy(() => import("../components/PropertyMap"));

const EMPTY_FILTERS = {
  q: "",
  bounds: null,
  type: "",
  operationType: "",
  // "" = disponibles y apartadas (las vendidas ya no se ofrecen como si estuvieran a la venta); "disponible" = solo disponibles;
  // "todas" = también las vendidas.
  status: "",
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

// Vistas del listado y cómo se escriben en la dirección (?vista=mapa|dividida).
// «dividida» = lista y mapa a la vez; solo en pantallas anchas.
const VIEW_PARAMS = { map: "mapa", split: "dividida" };
const viewFromParam = (value) => (value === "mapa" ? "map" : value === "dividida" ? "split" : "list");
const SPLIT_MEDIA = "(min-width: 981px)";
const SEARCH_DEBOUNCE_MS = 350;

// Referencia estable para "sin resultados todavía" (el mapa se reajusta si el arreglo cambia).
const EMPTY_LIST = [];

// Al abrir una ficha se anota hasta dónde iba el listado; al volver con «Atrás»
// se regresa justo ahí (el navegador no puede: el listado se vuelve a cargar).
const SCROLL_KEY = "acl_list_scroll";
const currentUrl = () => window.location.pathname + window.location.search;

// Se usa una sola vez: al entrar al listado por cualquier otro camino que «Atrás» la
// posición anotada se descarta, y tras restaurarla también (ver el efecto de abajo).
function readSavedScroll(navigationType) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null");
    if (navigationType !== "POP") {
      sessionStorage.removeItem(SCROLL_KEY);
      return null;
    }
    return saved && saved.path === currentUrl() && Number.isFinite(saved.y) ? saved.y : null;
  } catch {
    return null;
  }
}

function rememberScroll(event) {
  if (!event.target.closest?.('a[href^="/propiedades/"], a[href^="/desarrollos/"]')) return;
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ path: currentUrl(), y: window.scrollY }));
  } catch {
    /* sin almacenamiento: solo no se recuerda la posición */
  }
}

// El número de la oficina sale de lib/office.js (única fuente).

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
// `zoneFilter`: nombre exacto de una zona/colonia («Torreón - Las Villas»), página de aterrizaje por colonia: va al
// servidor como el filtro de zona normal. `noindex`: la página no debe indexarse (colonia sin propiedades).
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
  footerExtra,
  jsonLd,
  cityFilter,
  zoneFilter,
  noindex = false,
}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const restoreScrollY = useRef(undefined);
  if (restoreScrollY.current === undefined) restoreScrollY.current = readSavedScroll(navigationType);
  const resultsTopRef = useRef(null);
  const [filters, setFilters] = useState({
    q: searchParams.get("q") || "",
    bounds: boundsFromParam(searchParams.get("area")),
    type: searchParams.get("tipo") || "",
    operationType: searchParams.get("operacion") || "",
    status: ["disponible", "todas"].includes(searchParams.get("estatus")) ? searchParams.get("estatus") : "",
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
  // Lo que devuelve el servidor cuando la lista pagina allá (vista de lista) y
  // el conjunto completo cuando hace falta (mapa, vista dividida, filtro por ciudad).
  const [pageData, setPageData] = useState({ data: EMPTY_LIST, total: 0 });
  const [allMatches, setAllMatches] = useState(null);
  const [page, setPage] = useState(() => Math.max(0, (Number.parseInt(searchParams.get("pagina"), 10) || 1) - 1));
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [amenitiesCatalog, setAmenitiesCatalog] = useState([]);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState(() => viewFromParam(searchParams.get("vista")));
  const [developments, setDevelopments] = useState([]);
  const [searchText, setSearchText] = useState(() => searchParams.get("q") || "");
  const wide = useMediaQuery(SPLIT_MEDIA);
  // La vista dividida no cabe en pantallas angostas: ahí se ve la lista.
  const effectiveView = view === "split" && !wide ? "list" : view;
  const needsFullSet = effectiveView !== "list" || Boolean(cityFilter);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Cualquier cambio de filtro o de orden deja resultados viejos de otra
  // búsqueda en la página 2+; se regresa a la primera página para no
  // mostrar un vacío falso ("sin resultados") solo porque esa búsqueda
  // nueva no llega tan lejos.
  const goToFilters = (updater) => {
    setPage(0);
    setFilters(updater);
  };

  // «Buscar en esta zona» del mapa: el listado se queda con lo que hay a la vista.
  const searchThisArea = (bounds) => goToFilters((prev) => ({ ...prev, bounds }));

  useEffect(() => {
    // Torres publicadas: salen como una tarjeta cada una arriba del listado
    // general, no como un departamento por tarjeta (ver DevelopmentCard).
    db.getDevelopments({ publishedOnly: true }).then(setDevelopments).catch(() => setDevelopments([]));
    db.getZones().then(setZones).catch(() => setZones([]));
    db.getAmenities().then(setAmenitiesCatalog).catch(() => setAmenitiesCatalog([]));
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
    if (filters.q) params.set("q", filters.q);
    if (filters.type) params.set("tipo", filters.type);
    if (filters.operationType) params.set("operacion", filters.operationType);
    if (filters.status) params.set("estatus", filters.status);
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
    if (filters.bounds) params.set("area", boundsToParam(filters.bounds));
    // La página y la vista también viajan en la dirección: «Atrás» desde una
    // ficha regresa a la misma página, y la dirección se puede compartir.
    if (page > 0) params.set("pagina", String(page + 1));
    if (view !== "list") params.set("vista", VIEW_PARAMS[view]);
    setSearchParams(params, { replace: true });
  }, [filters, page, view, setSearchParams]);

  // Búsqueda de texto: se aplica sola poco después de dejar de escribir.
  useEffect(() => {
    const value = searchText.trim();
    const timer = setTimeout(() => {
      if (filtersRef.current.q === value) return;
      setPage(0);
      setFilters((prev) => ({ ...prev, q: value }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Y al revés: si otro control cambia la búsqueda (un chip, «Limpiar»), el campo la sigue.
  useEffect(() => {
    setSearchText((current) => (current.trim() === filters.q ? current : filters.q));
  }, [filters.q]);

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

  // Renta o venta: en Propiedades y también en Naves Industriales (muchas se rentan); Terrenos casi no se rentan, ahí no se ofrece.
  const showOperation = !fixedType || fixedType === "nave_industrial";

  const queryFilters = useMemo(
    () => ({
      activeOnly: true,
      type: fixedType || filters.type || undefined,
      types: fixedType || filters.type ? undefined : sectionTypes,
      operation_type: showOperation ? filters.operationType || undefined : undefined,
      statuses: filters.status === "todas" ? undefined : filters.status === "disponible" ? ["disponible"] : ["disponible", "apartada"],
      tipo_nave: fixedType === "nave_industrial" ? filters.tipoNave || undefined : undefined,
      zone: zoneFilter || filters.zone || undefined,
      // Una colonia fija (página de aterrizaje) coincide exacto; lo que la persona escribe a mano, por parte del nombre.
      zoneExact: zoneFilter ? true : undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      minArea: filters.minArea ? Number(filters.minArea) : undefined,
      maxArea: filters.maxArea ? Number(filters.maxArea) : undefined,
      minBedrooms: filters.minBedrooms ? Number(filters.minBedrooms) : undefined,
      minBathrooms: filters.minBathrooms ? Number(filters.minBathrooms) : undefined,
      minParking: filters.minParking ? Number(filters.minParking) : undefined,
      amenities: filters.amenities.length ? filters.amenities : undefined,
      q: filters.q || undefined,
      bounds: filters.bounds || undefined,
      sortBy: filters.sortBy,
    }),
    [filters, fixedType, sectionTypes, zoneFilter, showOperation]
  );

  // Cada tecla en precio, superficie o zona cambia `queryFilters`; a la base solo se le pregunta cuando la persona hace una pausa.
  const fetchFilters = useDebouncedValue(queryFilters, 300);

  // Mapa, vista dividida y filtro por ciudad piden el conjunto completo (cada
  // propiedad es un pin; la ciudad se resuelve en el cliente, ver `cityFilter`).
  useEffect(() => {
    if (!needsFullSet) return undefined;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    db.getProperties(fetchFilters)
      .then((data) => {
        if (active) setAllMatches(cityFilter ? data.filter((property) => propertyMatchesCity(property, cityFilter)) : data);
      })
      .catch((err) => {
        console.error("getProperties", err);
        if (active) setLoadFailed(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [needsFullSet, fetchFilters, cityFilter, reloadKey]);

  // La lista normal pide su página directo al servidor. Mientras llega la nueva
  // se siguen mostrando los resultados anteriores (atenuados): no brinca la página.
  useEffect(() => {
    if (needsFullSet) return undefined;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    db.getProperties({ ...fetchFilters, page, pageSize: PAGE_SIZE })
      .then(({ data, total: count }) => {
        if (active) setPageData({ data, total: count });
      })
      .catch((err) => {
        // Antes la lista se quedaba con los resultados de la búsqueda anterior y sin aviso: parecía que el filtro no hacía nada.
        console.error("getProperties", err);
        if (active) setLoadFailed(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [needsFullSet, fetchFilters, page, reloadKey]);

  const pins = needsFullSet ? allMatches || EMPTY_LIST : pageData.data;
  const total = needsFullSet ? pins.length : pageData.total;
  const properties = useMemo(
    () => (needsFullSet && effectiveView !== "map" ? pins.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : pins),
    [needsFullSet, effectiveView, pins, page]
  );
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  // «Visítala mañana»: el primer horario libre de las tarjetas que se ven (una sola consulta por página).
  // Si la base aún no tiene la función, simplemente no salen etiquetas.
  const [nextSlots, setNextSlots] = useState({});
  const visibleIdsKey = properties.map((p) => p.id).join(",");
  useEffect(() => {
    if (!visibleIdsKey) return undefined;
    let active = true;
    db.getNextVisitSlots(visibleIdsKey.split(","))
      .then((list) => active && setNextSlots(indexNextSlots(list)))
      .catch(() => active && setNextSlots({}));
    return () => {
      active = false;
    };
  }, [visibleIdsKey]);

  // Una dirección con una página que ya no existe (menos resultados que antes) cae en la última.
  useEffect(() => {
    if (!loading && total > 0 && page > lastPage) setPage(lastPage);
  }, [loading, total, page, lastPage]);

  // Con «Atrás» desde una ficha: de vuelta a donde iba el listado, una vez que ya hay tarjetas.
  useEffect(() => {
    if (loading || properties.length === 0 || restoreScrollY.current == null) return;
    const y = restoreScrollY.current;
    restoreScrollY.current = null;
    try {
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* sin almacenamiento */
    }
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [loading, properties.length]);

  const changePage = (delta) => {
    setPage((p) => Math.max(0, p + delta));
    resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chips = useMemo(
    () =>
      buildActiveFilterChips(filters, {
        t,
        fixedType,
        typeLabel: (key) => propertyTypeLabel(t, key),
        amenityLabel: (key) => amenitiesCatalog.find((a) => a.key === key)?.label || key,
      }),
    [filters, t, fixedType, amenitiesCatalog]
  );

  // Solo en el listado general, sin filtros ni mapa y en la primera página:
  // con una búsqueda activa las torres estorbarían a lo que la persona pidió.
  const showDevelopments = !fixedType && !cityFilter && !zoneFilter && !hasActiveFilters && page === 0 && effectiveView === "list" && developments.length > 0;

  const pageTitle = title || t(titleKey);
  const pageSubtitle = subtitle || t(subtitleKey);

  if (sectionDisabled) {
    return (
      <>
        <Seo title={pageTitle} description={pageSubtitle} />
        <div className="container properties-page">
          <div className="section-heading m-section">
            <h1>{pageTitle}</h1>
          </div>
          <EmptyState illustration="calendar" title={t("emptyState.comingSoonTitle")} text={t("properties.comingSoon")}>
            <NotifyMeCta section={pageTitle} />
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title={pageTitle} description={pageSubtitle} noindex={noindex} jsonLd={jsonLd} />

      <div className="container properties-page" onClickCapture={rememberScroll}>
        <div className="section-heading m-section">
          <h1>{pageTitle}</h1>
          <p>{pageSubtitle}</p>
        </div>

        {headerExtra}

        {showDevelopments && (
          <section className="properties-page__developments" aria-labelledby="developments-strip-title">
            <div className="properties-page__developments-head">
              <h3 id="developments-strip-title">{t("developments.stripTitle")}</h3>
              <p>{t("developments.stripSubtitle")}</p>
            </div>
            <div className="properties-page__developments-grid">
              {developments.map((development) => (
                <DevelopmentCard key={development.id} development={development} />
              ))}
            </div>
          </section>
        )}

        <div className="properties-page__layout">
          <aside>
            <PropertyFilters
              filters={filters}
              zones={zones}
              typeOptions={typeOptions}
              showOperation={showOperation}
              showNaveTipo={fixedType === "nave_industrial"}
              showHomeFilters={fixedType !== "terreno"}
              onChange={goToFilters}
              onClear={() => goToFilters(EMPTY_FILTERS)}
            />
          </aside>

          <div className={`properties-page__results${loading ? " is-loading" : ""}`} ref={resultsTopRef} aria-busy={loading}>
            <form
              className="properties-page__search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(0);
                setFilters((prev) => ({ ...prev, q: searchText.trim() }));
              }}
            >
              <label htmlFor="properties-search" className="visually-hidden">{t("properties.searchLabel")}</label>
              <input
                id="properties-search"
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t("properties.searchPlaceholder")}
                autoComplete="off"
                enterKeyHint="search"
                maxLength={80}
              />
            </form>

            {chips.length > 0 && (
              <ul className="properties-page__chips" aria-label={t("activeFilters.label")}>
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      className="filter-chip"
                      onClick={() => goToFilters((prev) => ({ ...prev, ...chip.patch }))}
                      aria-label={t("activeFilters.remove", { filter: chip.label })}
                    >
                      <span>{chip.label}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
                {chips.length > 1 && (
                  <li>
                    <button type="button" className="filter-chip filter-chip--clear" onClick={() => goToFilters(EMPTY_FILTERS)}>
                      {t("activeFilters.clearAll")}
                    </button>
                  </li>
                )}
              </ul>
            )}

            <div className="properties-page__toolbar">
              <span aria-live="polite">{t(total === 1 ? "properties.results_one" : "properties.results_other", { count: total })}</span>
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
                  <button type="button" className={effectiveView === "list" ? "active" : ""} aria-pressed={effectiveView === "list"} onClick={() => setView("list")}>
                    {t("properties.listView")}
                  </button>
                  <button type="button" className={effectiveView === "map" ? "active" : ""} aria-pressed={effectiveView === "map"} onClick={() => setView("map")}>
                    {t("properties.mapView")}
                  </button>
                  {wide && (
                    <button
                      type="button"
                      className={effectiveView === "split" ? "active" : ""}
                      aria-pressed={effectiveView === "split"}
                      title={t("properties.splitViewTitle")}
                      onClick={() => setView("split")}
                    >
                      {t("properties.splitView")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {loadFailed && !loading ? (
              <EmptyState illustration="signpost" title={t("loadError.title")} text={t("loadError.text")}>
                <button type="button" className="btn btn-primary" onClick={() => setReloadKey((n) => n + 1)}>
                  {t("loadError.retry")}
                </button>
              </EmptyState>
            ) : loading && properties.length === 0 ? (
              <LoadingState variant="cards" />
            ) : total === 0 ? (
              <EmptyState
                illustration="search"
                title={t(hasActiveFilters ? "emptyState.noResultsTitle" : "emptyState.emptySectionTitle")}
                text={t(hasActiveFilters ? "properties.noResults" : "properties.emptySection")}
              >
                {hasActiveFilters && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => goToFilters(EMPTY_FILTERS)}>
                    {t("activeFilters.clearAll")}
                  </button>
                )}
                <NotifyMeCta section={pageTitle} />
              </EmptyState>
            ) : effectiveView === "map" ? (
              <Suspense fallback={<LoadingState variant="block" height={560} />}>
                <PropertyMap properties={pins} height={560} onSearchArea={searchThisArea} areaActive={Boolean(filters.bounds)} />
              </Suspense>
            ) : (
              <div className={effectiveView === "split" ? "properties-split" : undefined}>
                <div className="properties-split__list">
                  <div className="properties-grid">
                    {/* Sin Reveal: las tarjetas del listado arrancaban invisibles y al volver de una ficha (o al imprimir) salían vacías un momento. */}
                    {properties.map((property) => (
                      <PropertyCard key={property.id} property={property} nextVisitSlot={nextSlots[property.id]} />
                    ))}
                  </div>
                  {total > PAGE_SIZE && (
                    <div className="properties-page__pagination">
                      <button type="button" className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => changePage(-1)}>
                        {t("properties.prevPage")}
                      </button>
                      <span>{t("properties.pageOf", { page: page + 1, pages: Math.ceil(total / PAGE_SIZE) })}</span>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={(page + 1) * PAGE_SIZE >= total}
                        onClick={() => changePage(1)}
                      >
                        {t("properties.nextPage")}
                      </button>
                    </div>
                  )}
                </div>
                {effectiveView === "split" && (
                  <div className="properties-split__map">
                    <Suspense fallback={<LoadingState variant="block" height="100%" />}>
                      <PropertyMap properties={pins} height="100%" onSearchArea={searchThisArea} areaActive={Boolean(filters.bounds)} />
                    </Suspense>
                  </div>
                )}
              </div>
            )}
            {!loading && (
              <AlertSignupCard
                mode="search"
                criteria={alertCriteria}
                matchCount={total}
              />
            )}
          </div>
        </div>
        {footerExtra}
      </div>
    </>
  );
}
