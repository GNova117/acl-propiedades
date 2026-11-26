import FactIcon from "../components/FactIcon";
import RichDescription from "../components/RichDescription";
import StickyPriceBar from "../components/StickyPriceBar";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import Gallery, { Lightbox } from "../components/Gallery";
import MortgageCalculator from "../components/MortgageCalculator";
import DownloadFichaButton from "../components/DownloadFichaButton";
import TravelTime from "../components/TravelTime";
import ContactRequestCard from "../components/ContactRequestCard";
import PropertyCard from "../components/PropertyCard";
import PropertyTypeIcon from "../components/PropertyTypeIcon";
import ShareButton from "../components/ShareButton";
import FavoriteButton from "../components/FavoriteButton";
import CompareButton from "../components/CompareButton";
import ScheduleVisitCard from "../components/ScheduleVisitCard";
import MobileContactBar from "../components/MobileContactBar";
import PropertyFlag from "../components/PropertyFlag";
import ZoneContext from "../components/ZoneContext";
import PropertyVideo from "../components/PropertyVideo";
import AlertSignupCard from "../components/AlertSignupCard";
import RecentlyViewed from "../components/RecentlyViewed";
import RecentViewsBadge from "../components/RecentViewsBadge";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { recordPropertyView } from "../lib/recentlyViewed";
import { buildSimilarCriteria } from "../lib/alertMatch";
import { getPropertyBadge } from "../lib/propertyBadges";
import { isClosedStatus } from "../lib/propertyStatus";
import { CALCULATOR_ANCHOR, canEstimateMonthly, estimateMonthlyPayment } from "../lib/monthlyEstimate";
import { directionsUrl, streetViewUrl, wazeUrl } from "../lib/mapLinks";
import { listingFrom } from "../lib/listNavigation";
import { formatMXN, formatArea, propertyTypeLabel, propertyShareLines, publicPlace, propertyListPath } from "../lib/format";
import "./PropertyDetail.css";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { isCanonicalSlug, listPathForMissingProperty, parsePropertyRef, propertyPath } from "../lib/propertyUrl.js";
import { breadcrumbJsonLd, faqJsonLd, propertyListingJsonLd } from "../lib/structuredData.js";
import { siteOrigin } from "../lib/site.js";
import { colonyPath } from "../lib/zoneLandingPages.js";

// Leaflet (react-leaflet + leaflet, ~150KB) queda fuera del bundle
// principal del sitio público — aquí siempre se termina mostrando (no es
// opcional como en /propiedades), pero separarlo en su propio chunk
// evita que cargue para cualquiera que solo visite el inicio o la lista.
const PropertyMap = lazy(() => import("../components/PropertyMap"));
// three.js (~150KB) solo se carga si alguien de verdad abre el recorrido
// 360°, no para cualquiera que entre a la ficha de la propiedad.
const Panorama360 = lazy(() => import("../components/Panorama360"));

// Todos los campos "especificaciones" que puede tener una propiedad —
// genéricos (NOM-247) más los propios de Naves Industriales. Se listan
// aquí para no repetir 17 bloques casi idénticos en el JSX; cada uno se
// muestra solo si la propiedad tiene ese dato capturado.
// Emoji por amenidad para el texto de "Compartir" — cubre las 8 sembradas
// de fábrica; cualquier amenidad nueva que se dé de alta desde
// /admin/zonas cae en el genérico "✅" en vez de romper o quedar sin ícono.
const AMENITY_EMOJI = {
  alberca: "🏊",
  seguridad_24h: "🔒",
  acepta_mascotas: "🐾",
  amueblado: "🛋️",
  estacionamiento_techado: "🚗",
  area_comun: "🌳",
  aire_acondicionado: "❄️",
  bodega: "📦",
};

const SPEC_FIELDS = [
  { key: "colindancias", labelKey: "detail.colindancias" },
  { key: "servicios", labelKey: "detail.servicios" },
  { key: "acabados", labelKey: "detail.acabados" },
  { key: "sistema_constructivo", labelKey: "detail.sistemaConstructivo" },
  { key: "techumbre", labelKey: "detail.techumbre" },
  { key: "condicion_propiedad", labelKey: "detail.condicionPropiedad" },
  { key: "estatus_construccion", labelKey: "detail.estatusConstruccion" },
  { key: "altura_libre", labelKey: "detail.alturaLibre", suffix: " m" },
  { key: "anio_construccion", labelKey: "detail.anioConstruccion" },
  { key: "area_minima_divisible", labelKey: "detail.areaMinimaDivisible", suffix: " m²" },
  { key: "area_oficina", labelKey: "detail.areaOficina", suffix: " m²" },
  { key: "luz_natural_pct", labelKey: "detail.luzNatural", suffix: "%" },
  { key: "sistema_contra_incendios", labelKey: "detail.sistemaContraIncendios" },
  { key: "tipo_seguridad", labelKey: "detail.tipoSeguridad" },
  { key: "andenes_carga", labelKey: "detail.andenesCarga" },
  { key: "rampas_vehiculares", labelKey: "detail.rampasVehiculares" },
  { key: "mantenimiento_pct", labelKey: "detail.mantenimiento", suffix: "%" },
];

// Ficha técnica de Naves Industriales — grupos de tarjetas al estilo de los
// portales del ramo (Spot2, etc.), a diferencia de la lista simple que usan
// casa/departamento/terreno. Es una función pura (no un componente) porque
// solo arma datos ya calculados a partir de `property`; cada fila se omite
// si el dato no fue capturado.
function buildFichaTecnica(property, t) {
  const isRenta = property.operation_type === "renta";
  const pricePerM2 = property.area_m2 > 0 ? property.price / property.area_m2 : null;
  const maintenanceAmount =
    isRenta && property.mantenimiento_pct != null ? (property.price * property.mantenimiento_pct) / 100 : null;

  const groups = [
    {
      titleKey: "detail.fichaTecnica.classification",
      rows: [
        [t("detail.fichaTecnica.propertyType"), propertyTypeLabel(t, property.type)],
        [t("detail.condicionPropiedad"), property.condicion_propiedad],
        [t("detail.estatusConstruccion"), property.estatus_construccion],
        [t("detail.techumbre"), property.techumbre],
        [t("detail.anioConstruccion"), property.anio_construccion],
      ],
    },
    {
      titleKey: "detail.fichaTecnica.dimensions",
      rows: [
        [t("detail.fichaTecnica.totalArea"), formatArea(property.area_m2)],
        [t("detail.areaMinimaDivisible"), property.area_minima_divisible != null ? formatArea(property.area_minima_divisible) : null],
        [t("detail.alturaLibre"), property.altura_libre != null ? `${property.altura_libre} m` : null],
        [t("detail.areaOficina"), property.area_oficina != null ? formatArea(property.area_oficina) : null],
        [t("detail.luzNatural"), property.luz_natural_pct != null ? `${property.luz_natural_pct}%` : null],
      ],
    },
    {
      titleKey: "detail.fichaTecnica.securityInfra",
      rows: [
        [t("detail.fichaTecnica.parkingSpaces"), property.parking],
        [t("detail.andenesCarga"), property.andenes_carga],
        [t("detail.rampasVehiculares"), property.rampas_vehiculares],
        [t("detail.sistemaContraIncendios"), property.sistema_contra_incendios],
        [t("detail.tipoSeguridad"), property.tipo_seguridad],
      ],
    },
    {
      titleKey: "detail.fichaTecnica.priceDetail",
      rows: [
        [t("detail.fichaTecnica.operationType"), t(`propertyOperation.${property.operation_type}`)],
        [t("detail.fichaTecnica.totalPrice"), formatMXN(property.price)],
        [t("detail.fichaTecnica.pricePerM2"), pricePerM2 != null ? formatMXN(pricePerM2) : null],
        [t("detail.mantenimiento"), property.mantenimiento_pct != null ? `${property.mantenimiento_pct}%` : null],
        [t("detail.fichaTecnica.maintenanceAmount"), maintenanceAmount != null ? formatMXN(maintenanceAmount) : null],
        [t("detail.fichaTecnica.totalMonthly"), maintenanceAmount != null ? formatMXN(property.price + maintenanceAmount) : null],
      ],
    },
    {
      titleKey: "detail.specsTitle",
      rows: [
        [t("detail.colindancias"), property.colindancias],
        [t("detail.servicios"), property.servicios],
        [t("detail.acabados"), property.acabados],
        [t("detail.sistemaConstructivo"), property.sistema_constructivo],
      ],
    },
  ];

  return groups
    .map((group) => ({ ...group, rows: group.rows.filter(([, value]) => value != null && value !== "") }))
    .filter((group) => group.rows.length > 0);
}

// FAQ autogenerado a partir de los datos reales de la propiedad — nunca
// afirma nada sobre un campo que no fue capturado (ausencia de dato no es
// "no", así que esas preguntas simplemente no se incluyen). Máximo 6
// preguntas para no saturar la página.
function buildFaq(property, t) {
  const candidates = [];

  if (property.operation_type === "renta") {
    candidates.push([t("detail.faq.rentQ"), t("detail.faq.rentA", { price: formatMXN(property.price) })]);
  } else {
    candidates.push([t("detail.faq.saleQ"), t("detail.faq.saleA", { price: formatMXN(property.price) })]);
  }

  candidates.push([
    t("detail.faq.areaQ"),
    property.area_minima_divisible != null
      ? t("detail.faq.areaWithMinA", { total: formatArea(property.area_m2), min: formatArea(property.area_minima_divisible) })
      : t("detail.faq.areaA", { area: formatArea(property.area_m2) }),
  ]);

  if (property.address && property.zone) {
    candidates.push([t("detail.faq.locationQ"), t("detail.faq.locationA", { address: publicPlace(property), zone: property.zone })]);
  }

  if (property.type === "nave_industrial") {
    if (property.andenes_carga != null) candidates.push([t("detail.faq.docksQ"), t("detail.faq.docksA", { count: property.andenes_carga })]);
    if (property.altura_libre != null) candidates.push([t("detail.faq.heightQ"), t("detail.faq.heightA", { height: property.altura_libre })]);
    if (property.tipo_seguridad) candidates.push([t("detail.faq.securityQ"), t("detail.faq.securityA", { security: property.tipo_seguridad })]);
    if (property.sistema_contra_incendios) candidates.push([t("detail.faq.fireQ"), t("detail.faq.fireA", { system: property.sistema_contra_incendios })]);
    if (property.anio_construccion != null) candidates.push([t("detail.faq.yearQ"), t("detail.faq.yearA", { year: property.anio_construccion })]);
  } else {
    if (property.bedrooms != null) candidates.push([t("detail.faq.bedroomsQ"), t("detail.faq.bedroomsA", { count: property.bedrooms })]);
    if (property.bathrooms != null) candidates.push([t("detail.faq.bathroomsQ"), t("detail.faq.bathroomsA", { count: property.bathrooms })]);
  }

  if (property.parking != null) candidates.push([t("detail.faq.parkingQ"), t("detail.faq.parkingA", { count: property.parking })]);

  return candidates.slice(0, 6);
}

export default function PropertyDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [property, setProperty] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState([]);
  const [amenitiesCatalog, setAmenitiesCatalog] = useState([]);
  const [showPanorama, setShowPanorama] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Si llegó desde un listado, «Volver» regresa a ese listado (con filtros, página y posición).
  const listFrom = listingFrom(location.state);
  const handleBack = (e) => {
    if (!listFrom) return;
    e.preventDefault();
    navigate(-1);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    // La dirección puede ser el slug legible («casa-en-senderos-ACL-12»), el código solo o el id de siempre (enlaces ya
    // compartidos): todas llegan a la misma ficha y, si no es la forma canónica, se corrige la barra de direcciones.
    const ref = parsePropertyRef(id);
    (ref.kind === "code" ? db.getPropertyByCode(ref.code) : db.getPropertyById(ref.id))
      .then((data) => active && setProperty(data))
      // Un fallo de red NO es «propiedad no encontrada»: se avisa aparte y se ofrece reintentar.
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  useEffect(() => {
    if (property && !isCanonicalSlug(id, property)) navigate(`${propertyPath(property)}${location.search}`, { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, id]);

  useEffect(() => {
    db.getAmenities().then(setAmenitiesCatalog).catch(() => setAmenitiesCatalog([]));
  }, []);

  useEffect(() => {
    if (property?.id) recordPropertyView(property.id);
  }, [property?.id]);

  const seoTitle = useMemo(() => {
    if (!property) return "";
    // Vendida o rentada: el título ya no dice «en Venta — $precio» (decía lo contrario de la verdad).
    if (isClosedStatus(property.status)) return t(property.status === "rentada" ? "detail.seoTitleRented" : "detail.seoTitleSold", { type: propertyTypeLabel(t, property.type), zone: property.zone });
    return t("detail.seoTitle", { type: propertyTypeLabel(t, property.type), operation: t(`propertyOperation.${property.operation_type}`), zone: property.zone, price: formatMXN(property.price) });
  }, [property, t]);

  const seoDescription = useMemo(() => {
    if (!property) return "";
    const facts = [
      property.bedrooms != null && `${property.bedrooms} ${t("properties.bedrooms")}`,
      property.bathrooms != null && `${property.bathrooms} ${t("properties.bathrooms")}`,
      formatArea(property.area_m2),
    ]
      .filter(Boolean)
      .join(", ");
    const lead = t("detail.seoLead", { facts, zone: property.zone });
    const remaining = Math.max(0, 155 - lead.length);
    return `${lead}${(property.description || "").slice(0, remaining)}`.trim();
  }, [property, t]);

  const jsonLd = useMemo(() => {
    if (!property || typeof window === "undefined") return undefined;
    const origin = siteOrigin();
    const url = `${origin}${propertyPath(property)}`;
    const listPath = propertyListPath(property.type);
    const listName = property.type === "terreno" ? t("nav.land") : property.type === "nave_industrial" ? t("nav.industrial") : t("nav.properties");
    return [
      propertyListingJsonLd({ property, url }),
      breadcrumbJsonLd([
        { name: t("nav.home"), url: origin },
        { name: listName, url: `${origin}${listPath}` },
        { name: property.title, url },
      ]),
      faqJsonLd(buildFaq(property, t)),
    ].filter(Boolean);
  }, [property, t]);

  const propertyAmenities = useMemo(() => {
    if (!property?.amenities?.length) return [];
    return amenitiesCatalog.filter((a) => property.amenities.includes(a.key));
  }, [property, amenitiesCatalog]);

  // Texto para compartir en WhatsApp/redes, al estilo de las fichas que ya
  // circulan en otros portales inmobiliarios (bloque con emojis + datos
  // clave + link al final) — mucho más útil al reenviarse que un simple
  // "Título — URL", que es lo único que se ve al abrirlo en otro lado.
  const shareText = useMemo(() => {
    if (!property || typeof window === "undefined") return "";
    const lines = propertyShareLines(property, t);
    propertyAmenities.forEach((amenity) => lines.push(`${AMENITY_EMOJI[amenity.key] || "✅"} ${amenity.label}`));
    lines.push("", `${siteOrigin()}${propertyPath(property)}`);
    return lines.join("\n");
  }, [property, propertyAmenities, t]);

  // Espacios similares: mismo tipo, disponibles, priorizando la misma zona.
  // No es una recomendación "inteligente" — es un filtro simple y honesto.
  useEffect(() => {
    if (!property) return;
    let active = true;
    // Solo se piden unas cuantas (antes se bajaba TODO el catálogo del mismo tipo para elegir 4): primero las de la misma zona y, si
    // faltan, las demás del tipo.
    const base = { type: property.type, activeOnly: true, statuses: ["disponible"], page: 0 };
    const pick = (rows, chosen) => rows.filter((p) => p.id !== property.id && !chosen.some((c) => c.id === p.id));
    (async () => {
      const chosen = [];
      if (property.zone) {
        const sameZone = await db.getProperties({ ...base, zone: property.zone, zoneExact: true, pageSize: 5 });
        chosen.push(...pick(sameZone.data, chosen));
      }
      if (chosen.length < 4) {
        const anyZone = await db.getProperties({ ...base, pageSize: 8 });
        chosen.push(...pick(anyZone.data, chosen));
      }
      if (active) setSimilar(chosen.slice(0, 4));
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [property?.id, property?.type, property?.zone]);

  if (loading) return <LoadingState tall />;
  if (loadFailed) {
    return (
      <>
        <Seo title={t("loadError.title")} noindex />
        <EmptyState illustration="signpost" title={t("loadError.title")} text={t("loadError.text")}>
          <button type="button" className="btn btn-primary" onClick={() => setReloadKey((n) => n + 1)}>{t("loadError.retry")}</button>
        </EmptyState>
      </>
    );
  }
  const badge = getPropertyBadge(property);
  const priceDrop = badge?.kind === "priceDrop" ? badge : null;
  const monthly = estimateMonthlyPayment(property);

  // Una propiedad desactivada (borrador) solo la ve el personal con sesión; para cualquier otra persona es como
  // si no existiera. En Supabase la base ya no la entrega (ver schema.sql); esto cubre el modo demostración.
  if (!property || (property.active === false && !isAuthenticated)) {
    return (
      <>
        <Seo title={t("detail.notFound")} noindex />
        <EmptyState illustration="signpost" title={t("emptyState.propertyGoneTitle")} text={t("detail.notFound")}>
          <Link to={listPathForMissingProperty(id)} className="btn btn-primary">{t("detail.back")}</Link>
        </EmptyState>
      </>
    );
  }

  // Mientras se corrige la dirección (el cambio de ruta vuelve a montar la página) no se muestra la ficha a medias.
  if (!isCanonicalSlug(id, property)) return <LoadingState tall />;

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} image={`${siteOrigin()}/api/og?id=${encodeURIComponent(property.id)}`} jsonLd={jsonLd} noindex={property.active === false} />

      <div className="container property-detail">
        <Link to={listFrom || "/propiedades"} onClick={handleBack} className="property-detail__back">
          &larr; {t("detail.back")}
        </Link>

        <div className="property-detail__layout">
          <div>
            <Gallery images={property.images} alt={property.title} />

            {property.tour_360_images?.length > 0 && (
              <button type="button" className="btn btn-outline property-detail__tour360-btn" onClick={() => setShowPanorama(true)}>
                {t("panorama360.viewButton")}
              </button>
            )}

            <div className="property-detail__header">
              <div>
                <div className="property-card__type">
                  <PropertyTypeIcon type={property.type} size={16} />
                  <span>{propertyTypeLabel(t, property.type)}</span>
                  <span className="property-card__zone">· {colonyPath(property.zone) ? <Link to={colonyPath(property.zone)}>{property.zone}</Link> : property.zone}</span>
                </div>
                <h1>{property.title}</h1>
                <p className="property-detail__address">{publicPlace(property)}</p>
                {/* El código es lo que el cliente cita por teléfono o WhatsApp (el sitio ofrece «Buscar por código»). */}
                {property.code && (
                  <p className="property-detail__code">
                    {t("detail.codeLabel")}: <strong>{property.code}</strong>
                  </p>
                )}
                <RecentViewsBadge propertyId={property.id} />
              </div>
              <div className="property-detail__price-block">
                <div className="property-detail__price-block-top">
                  <span className={`badge badge-${property.status === "disponible" ? "available" : property.status === "apartada" ? "reserved" : "sold"}`}>
                    {t(`propertyStatus.${property.status}`)}
                  </span>
                  <PropertyFlag property={property} />
                  <FavoriteButton propertyId={property.id} className="favorite-button--inline" />
                  <CompareButton propertyId={property.id} className="compare-button--inline" />
                  <ShareButton title={seoTitle} text={shareText} url={`${siteOrigin()}${propertyPath(property)}`} propertyId={property.id} />
                </div>
                <span className="property-detail__price">{formatMXN(property.price)}{property.operation_type === "renta" && <small className="property-price-period">{t("propertyOperation.perMonth")}</small>}</span>
                {priceDrop && (
                  <p className="property-detail__was-price">
                    <s>{formatMXN(priceDrop.previousPrice)}</s>
                  </p>
                )}
                {monthly && (
                  <div className="property-detail__monthly">
                    <strong>{t("monthlyEstimate.fromPerMonth", { amount: formatMXN(monthly.payment) })}</strong>
                    <span>{t("monthlyEstimate.hint", { down: monthly.downPct, years: monthly.years, rate: monthly.rate })}</span>
                    <button
                      type="button"
                      className="property-detail__monthly-adjust"
                      onClick={() => document.getElementById(CALCULATOR_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    >
                      {t("mortgageCalc.adjust")}
                    </button>
                    <Link to={`/comparar-creditos?propiedad=${property.id}`}>{t("monthlyEstimate.cta")}</Link>
                  </div>
                )}
                <p className="property-detail__credit-notice">{t("detail.creditNotice")}</p>
              </div>
            </div>

            {property.type !== "nave_industrial" && (
              <ul className="property-detail__features">
                <li><FactIcon name="area" size={22} /><strong>{formatArea(property.area_m2)}</strong><span>{t("properties.area")}</span></li>
                {property.bedrooms != null && (
                  <li><FactIcon name="bed" size={22} /><strong>{property.bedrooms}</strong><span>{t("properties.bedrooms")}</span></li>
                )}
                {property.bathrooms != null && (
                  <li><FactIcon name="bath" size={22} /><strong>{property.bathrooms}</strong><span>{t("properties.bathrooms")}</span></li>
                )}
                {property.parking != null && (
                  <li><FactIcon name="car" size={22} /><strong>{property.parking}</strong><span>{t("properties.parking")}</span></li>
                )}
              </ul>
            )}

            <section>
              <h2>{t("detail.description")}</h2>
              <RichDescription text={property.description} />
              <DownloadFichaButton property={property} />
            </section>

            {propertyAmenities.length > 0 && (
              <section>
                <h2>{t("detail.amenitiesTitle")}</h2>
                <ul className="property-detail__amenities">
                  {propertyAmenities.map((amenity) => (
                    <li key={amenity.id}>{amenity.label}</li>
                  ))}
                </ul>
              </section>
            )}

            {property.videos && property.videos.length > 0 && (
              <section>
                <h2>{t("detail.videosTitle")}</h2>
                <div className="property-detail__videos">
                  {property.videos.map((src) => (
                    <PropertyVideo key={src} src={src} />
                  ))}
                </div>
              </section>
            )}

            {property.type === "nave_industrial" ? (
              (() => {
                const groups = buildFichaTecnica(property, t);
                if (groups.length === 0) return null;
                return (
                  <section>
                    <h2>{t("detail.fichaTecnica.title")}</h2>
                    <div className="property-detail__ficha-grid">
                      {groups.map((group) => (
                        <div className="card property-detail__ficha-card" key={group.titleKey}>
                          <h3>{t(group.titleKey)}</h3>
                          <dl>
                            {group.rows.map(([label, value]) => (
                              <div className="property-detail__ficha-row" key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })()
            ) : (
              (() => {
                const specEntries = SPEC_FIELDS.filter((f) => property[f.key] != null && property[f.key] !== "");
                if (specEntries.length === 0) return null;
                return (
                  <section>
                    <h2>{t("detail.specsTitle")}</h2>
                    <ul className="property-detail__specs">
                      {specEntries.map((f) => (
                        <li key={f.key}><strong>{t(f.labelKey)}:</strong> {property[f.key]}{f.suffix || ""}</li>
                      ))}
                    </ul>
                  </section>
                );
              })()
            )}

            {property.floor_plan_url && (
              <section>
                <h2>{t("floorPlan.title")}</h2>
                <button type="button" className="property-detail__plan" onClick={() => setShowPlan(true)} aria-label={t("floorPlan.open")}>
                  <img src={property.floor_plan_url} alt={t("floorPlan.alt", { title: property.title })} loading="lazy" decoding="async" />
                  <span className="gallery__expand-badge">⤢ {t("gallery.expand")}</span>
                </button>
                <p className="form-hint">{t("floorPlan.note")}</p>
              </section>
            )}

            <section>
              <h2>{t("detail.location")}</h2>
              <Suspense fallback={<LoadingState variant="block" height={360} />}>
                <PropertyMap properties={[property]} height={360} />
              </Suspense>
              {property.location_approximate && <p className="form-hint">{t("detail.locationApproximate")}</p>}
              {!property.location_approximate && directionsUrl(property) && (
                <div className="property-detail__map-actions">
                  <a className="btn btn-primary btn-sm" href={directionsUrl(property)} target="_blank" rel="noopener noreferrer">
                    {t("mapLinks.directions")}
                  </a>
                  <a className="btn btn-outline btn-sm" href={streetViewUrl(property)} target="_blank" rel="noopener noreferrer">
                    {t("mapLinks.streetView")}
                  </a>
                  <a className="btn btn-outline btn-sm" href={wazeUrl(property)} target="_blank" rel="noopener noreferrer">
                    {t("mapLinks.waze")}
                  </a>
                </div>
              )}
              {!property.location_approximate && <TravelTime property={property} />}
            </section>

            <ZoneContext property={property} />

            {/* Los datos del asesor (teléfono/correo/WhatsApp) ya no se
                publican en la ficha: aquí el interesado deja su nombre y su
                teléfono y el asesor le marca. Va en la columna principal,
                justo antes de las preguntas frecuentes, no en la barra
                lateral. El asesor asignado se sigue viendo en el panel y en
                la ficha técnica en PDF. */}
            {canEstimateMonthly(property) && <MortgageCalculator property={property} />}

            <div className="card" style={{ padding: "1.1rem 1.25rem", marginBottom: "1.25rem" }}>
              <strong>{t("detail.compareCredits.title")}</strong>
              <p className="form-hint" style={{ margin: "0.25rem 0 0.75rem" }}>{t("detail.compareCredits.text")}</p>
              <Link to={`/comparar-creditos?propiedad=${property.id}`} className="btn btn-outline btn-sm">
                {t("detail.compareCredits.cta")}
              </Link>
            </div>

            {property.status === "disponible" ? (
              <AlertSignupCard mode="price" property={property} />
            ) : (
              <AlertSignupCard mode="search" variant="similar" criteria={buildSimilarCriteria(property)} />
            )}

            <ContactRequestCard property={property} />

            {(() => {
              const faq = buildFaq(property, t);
              if (faq.length === 0) return null;
              return (
                <section>
                  <h2>{t("detail.faq.title")}</h2>
                  <div className="property-detail__faq">
                    {faq.map(([question, answer]) => (
                      <details className="property-detail__faq-item" key={question}>
                        <summary>{question}</summary>
                        <p>{answer}</p>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })()}
          </div>

          <aside className="property-detail__sidebar">
            {isClosedStatus(property.status) ? (
              <div className="card schedule-visit-card">
                <h3 className="property-detail__sidebar-title">{t(property.status === "rentada" ? "detail.rentedTitle" : "detail.soldTitle")}</h3>
                <p className="form-hint">{t("detail.soldText")}</p>
                <Link to={propertyListPath(property.type)} className="btn btn-primary btn-block">{t("detail.soldCta")}</Link>
              </div>
            ) : (
              <ScheduleVisitCard key={property.id} property={property} />
            )}
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="property-detail__similar">
            <h2>{t("detail.similarTitle")}</h2>
            <div className="property-detail__similar-row">
              {similar.map((p) => (
                <div className="property-detail__similar-item" key={p.id}>
                  <PropertyCard property={p} />
                </div>
              ))}
            </div>
          </section>
        )}

        <RecentlyViewed excludeId={property.id} />
      </div>

      {!isClosedStatus(property.status) && <MobileContactBar property={property} />}
      {!isClosedStatus(property.status) && <StickyPriceBar property={property} />}

      {showPlan && (
        <Lightbox images={[property.floor_plan_url]} index={0} onIndexChange={() => {}} onClose={() => setShowPlan(false)} alt={t("floorPlan.alt", { title: property.title })} />
      )}

      {showPanorama && (
        <Suspense fallback={null}>
          <Panorama360 images={property.tour_360_images} onClose={() => setShowPanorama(false)} />
        </Suspense>
      )}
    </>
  );
}
