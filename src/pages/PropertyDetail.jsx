import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import Gallery from "../components/Gallery";
import AdvisorCard from "../components/AdvisorCard";
import PropertyTypeIcon from "../components/PropertyTypeIcon";
import PropertyMap from "../components/PropertyMap";
import { db } from "../lib/dataStore";
import { formatMXN, formatArea, propertyTypeLabel } from "../lib/format";
import "./PropertyDetail.css";

// Todos los campos "especificaciones" que puede tener una propiedad —
// genéricos (NOM-247) más los propios de Naves Industriales. Se listan
// aquí para no repetir 17 bloques casi idénticos en el JSX; cada uno se
// muestra solo si la propiedad tiene ese dato capturado.
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

export default function PropertyDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <Seo title={property.title} description={property.description} />

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
                <span className={`badge badge-${property.status === "disponible" ? "available" : property.status === "apartada" ? "reserved" : "sold"}`}>
                  {t(`propertyStatus.${property.status}`)}
                </span>
                <span className="property-detail__price">{formatMXN(property.price)}</span>
                <p className="property-detail__credit-notice">{t("detail.creditNotice")}</p>
              </div>
            </div>

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

            <section>
              <h2>{t("detail.description")}</h2>
              <p>{property.description}</p>
            </section>

            {(() => {
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
            })()}

            <section>
              <h2>{t("detail.location")}</h2>
              <PropertyMap properties={[property]} height={360} />
            </section>
          </div>

          <aside className="property-detail__sidebar">
            <h3 className="property-detail__sidebar-title">{t("detail.advisorCard")}</h3>
            {property.advisors && property.advisors.length > 0 ? (
              property.advisors.map((advisor) => <AdvisorCard key={advisor.id} advisor={advisor} />)
            ) : (
              <p>{t("properties.noResults")}</p>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
