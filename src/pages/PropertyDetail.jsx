import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import Gallery from "../components/Gallery";
import AdvisorCard from "../components/AdvisorCard";
import PropertyCard from "../components/PropertyCard";
import PropertyTypeIcon from "../components/PropertyTypeIcon";
import ShareButton from "../components/ShareButton";
import FavoriteButton from "../components/FavoriteButton";
import { db } from "../lib/dataStore";
import { formatMXN, formatArea, propertyTypeLabel } from "../lib/format";
import "./PropertyDetail.css";

// Leaflet (react-leaflet + leaflet, ~150KB) queda fuera del bundle
// principal del sitio público — aquí siempre se termina mostrando (no es
// opcional como en /propiedades), pero separarlo en su propio chunk
// evita que cargue para cualquiera que solo visite el inicio o la lista.
const PropertyMap = lazy(() => import("../components/PropertyMap"));

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
    candidates.push([t("detail.faq.locationQ"), t("detail.faq.locationA", { address: property.address, zone: property.zone })]);
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
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState([]);
  const [amenitiesCatalog, setAmenitiesCatalog] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.getPropertyById(id)
      .then((data) => active && setProperty(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    db.getAmenities().then(setAmenitiesCatalog).catch(() => setAmenitiesCatalog([]));
  }, []);

  const seoTitle = useMemo(() => {
    if (!property) return "";
    return `${propertyTypeLabel(t, property.type)} en ${t(`propertyOperation.${property.operation_type}`)} — ${property.zone} · ${formatMXN(property.price)}`;
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
    const lead = `${facts} en ${property.zone}. `;
    const remaining = Math.max(0, 155 - lead.length);
    return `${lead}${(property.description || "").slice(0, remaining)}`.trim();
  }, [property, t]);

  const jsonLd = useMemo(() => {
    if (!property || typeof window === "undefined") return undefined;
    const url = `${window.location.origin}/propiedades/${property.id}`;
    return [
      {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        name: property.title,
        description: property.description,
        url,
        image: property.images,
        offers: {
          "@type": "Offer",
          price: property.price,
          priceCurrency: "MXN",
          availability: property.status === "disponible" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: property.address,
          addressLocality: property.zone,
          addressCountry: "MX",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: property.lat,
          longitude: property.lng,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: window.location.origin },
          { "@type": "ListItem", position: 2, name: "Propiedades", item: `${window.location.origin}/propiedades` },
          { "@type": "ListItem", position: 3, name: property.title, item: url },
        ],
      },
    ];
  }, [property]);

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
    const lines = [
      `📍 ${t(`propertyOperation.${property.operation_type}`)} | ${propertyTypeLabel(t, property.type)} en ${property.address}`,
      "",
      `💰 ${formatMXN(property.price)} MXN`,
      `📐 ${formatArea(property.area_m2)}`,
    ];
    if (property.bedrooms != null) lines.push(`🛌 ${property.bedrooms} recámaras`);
    if (property.bathrooms != null) lines.push(`🛁 ${property.bathrooms} baños`);
    if (property.parking != null) lines.push(`🚗 ${property.parking} estacionamientos`);
    propertyAmenities.forEach((amenity) => lines.push(`${AMENITY_EMOJI[amenity.key] || "✅"} ${amenity.label}`));
    lines.push("", `${window.location.origin}/propiedades/${property.id}`);
    return lines.join("\n");
  }, [property, propertyAmenities, t]);

  // Espacios similares: mismo tipo, disponibles, priorizando la misma zona.
  // No es una recomendación "inteligente" — es un filtro simple y honesto.
  useEffect(() => {
    if (!property) return;
    let active = true;
    db.getProperties({ type: property.type, activeOnly: true }).then((data) => {
      if (!active) return;
      const others = data.filter((p) => p.id !== property.id && p.status === "disponible");
      others.sort((a, b) => (a.zone === property.zone ? 0 : 1) - (b.zone === property.zone ? 0 : 1));
      setSimilar(others.slice(0, 4));
    });
    return () => {
      active = false;
    };
  }, [property?.id, property?.type, property?.zone]);

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;
  if (!property) {
    return (
      <div className="empty-state">
        <p>{t("detail.notFound")}</p>
        <Link to="/propiedades" className="btn btn-primary">{t("detail.back")}</Link>
      </div>
    );
  }

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} jsonLd={jsonLd} />

      <div className="container property-detail">
        <Link to="/propiedades" className="property-detail__back">
          &larr; {t("detail.back")}
        </Link>

        <div className="property-detail__layout">
          <div>
            <Gallery images={property.images} alt={property.title} />

            <div className="property-detail__header">
              <div>
                <div className="property-card__type">
                  <PropertyTypeIcon type={property.type} size={16} />
                  <span>{propertyTypeLabel(t, property.type)}</span>
                  <span className="property-card__zone">· {property.zone}</span>
                </div>
                <h1>{property.title}</h1>
                <p className="property-detail__address">{property.address}</p>
              </div>
              <div className="property-detail__price-block">
                <div className="property-detail__price-block-top">
                  <span className={`badge badge-${property.status === "disponible" ? "available" : property.status === "apartada" ? "reserved" : "sold"}`}>
                    {t(`propertyStatus.${property.status}`)}
                  </span>
                  <FavoriteButton propertyId={property.id} className="favorite-button--inline" />
                  <ShareButton title={seoTitle} text={shareText} url={`${window.location.origin}/propiedades/${property.id}`} />
                </div>
                <span className="property-detail__price">{formatMXN(property.price)}</span>
                <p className="property-detail__credit-notice">{t("detail.creditNotice")}</p>
              </div>
            </div>

            {property.type !== "nave_industrial" && (
              <ul className="property-detail__features">
                <li><strong>{formatArea(property.area_m2)}</strong><span>{t("properties.area")}</span></li>
                {property.bedrooms != null && (
                  <li><strong>{property.bedrooms}</strong><span>{t("properties.bedrooms")}</span></li>
                )}
                {property.bathrooms != null && (
                  <li><strong>{property.bathrooms}</strong><span>{t("properties.bathrooms")}</span></li>
                )}
                {property.parking != null && (
                  <li><strong>{property.parking}</strong><span>Estacionamiento</span></li>
                )}
              </ul>
            )}

            <section>
              <h2>{t("detail.description")}</h2>
              <p>{property.description}</p>
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
                    <video key={src} src={src} controls preload="metadata" />
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

            <section>
              <h2>{t("detail.location")}</h2>
              <Suspense fallback={<div className="empty-state" style={{ height: 360 }}>{t("common.loading")}</div>}>
                <PropertyMap properties={[property]} height={360} />
              </Suspense>
            </section>

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
            <h3 className="property-detail__sidebar-title">{t("detail.advisorCard")}</h3>
            {property.advisors && property.advisors.length > 0 ? (
              property.advisors.map((advisor) => <AdvisorCard key={advisor.id} advisor={advisor} property={property} />)
            ) : (
              <p>{t("properties.noResults")}</p>
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
      </div>
    </>
  );
}
