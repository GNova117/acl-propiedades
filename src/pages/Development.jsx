import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import Reveal from "../components/Reveal";
import Gallery from "../components/Gallery";
import DevelopmentProvenance from "../components/development/DevelopmentProvenance";
import AvailabilityMap from "../components/development/AvailabilityMap";
import UnitDialog from "../components/development/UnitDialog";
import { db } from "../lib/dataStore";
import {
  developmentStats,
  modelStats,
  filterUnits,
  resolveUnit,
  developmentWhatsappText,
  EMPTY_UNIT_FILTERS,
} from "../lib/developments";
import { formatMXN, formatArea } from "../lib/format";
import { estimateMonthlyPayment } from "../lib/monthlyEstimate";
import { OFFICE_WHATSAPP } from "../lib/office";
import "../components/development/development.css";
import "./Development.css";

const SORT_OPTIONS = ["floor_desc", "floor_asc", "price_asc", "price_desc"];
const PAGE_SIZE = 12;

function Stat({ label, value, sub }) {
  return (
    <div className="dev-stat">
      <span className="dev-stat__label">{label}</span>
      <strong className="dev-stat__value">{value}</strong>
      {sub && <span className="dev-stat__sub">{sub}</span>}
    </div>
  );
}

function UnitCard({ unit, onOpen, t }) {
  const monthly = estimateMonthlyPayment(unit);
  return (
    <button type="button" className={`dev-unit card dev-unit--${unit.status}`} onClick={() => onOpen(unit.number)}>
      <span className="dev-unit__image">
        {unit.images[0] && <img src={unit.images[0]} alt="" loading="lazy" decoding="async" />}
        <span className={`dev-status dev-status--${unit.status}`}>{t(`developments.legend.${unit.status}`)}</span>
      </span>
      <span className="dev-unit__body">
        <span className="dev-unit__title">{t("developments.unit.title", { number: unit.number })}</span>
        <span className="dev-unit__sub">
          {unit.model_name} · {t("developments.unit.floor", { floor: unit.floor })}
          {unit.view ? ` · ${unit.view}` : ""}
        </span>
        <span className="dev-unit__price">{formatMXN(unit.price)}</span>
        {monthly && <span className="dev-unit__monthly">{t("developments.unit.perMonth", { amount: formatMXN(monthly.payment) })}</span>}
        <span className="dev-unit__meta">
          {unit.area_m2 != null && <span>{formatArea(unit.area_m2)}</span>}
          {unit.bedrooms != null && <span>{t("developments.model.bedrooms", { count: unit.bedrooms })}</span>}
          {unit.bathrooms != null && <span>{t("developments.model.bathrooms", { count: unit.bathrooms })}</span>}
        </span>
      </span>
    </button>
  );
}

export default function Development() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [development, setDevelopment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_UNIT_FILTERS);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.getDevelopmentBySlug(slug)
      .then((data) => active && setDevelopment(data))
      .catch(() => active && setDevelopment(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  const stats = useMemo(() => (development ? developmentStats(development) : null), [development]);
  const models = useMemo(() => (development ? modelStats(development) : []), [development]);
  const units = useMemo(() => (development ? filterUnits(development, filters) : []), [development, filters]);

  const openNumber = searchParams.get("depto");
  const openUnit = useMemo(() => {
    if (!development || !openNumber) return null;
    const raw = development.units.find((u) => u.number === openNumber);
    return raw ? resolveUnit(development, raw) : null;
  }, [development, openNumber]);

  const openUnitDialog = (number) => setSearchParams({ depto: number }, { replace: true });
  const closeUnitDialog = () => setSearchParams({}, { replace: true });

  const updateFilters = (patch) => {
    setVisible(PAGE_SIZE);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const showModel = (key) => {
    updateFilters({ model: key });
    document.getElementById("departamentos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;
  if (!development) {
    return (
      <div className="container empty-state">
        <p>{t("developments.notFound")}</p>
        <Link to="/propiedades" className="btn btn-primary btn-sm">
          {t("developments.backToProperties")}
        </Link>
      </div>
    );
  }

  const pageUrl = `${window.location.origin}/desarrollos/${development.slug}`;
  const whatsappUrl = `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(developmentWhatsappText(development, pageUrl))}`;
  const seoImage = development.hero_image?.startsWith("http") ? development.hero_image : undefined;
  const filtersActive = filters.model || filters.bedrooms !== "" || filters.floorFrom !== "" || filters.maxPrice || filters.status !== "disponible";
  const maxBedrooms = Math.max(0, ...development.models.map((m) => Number(m.bedrooms) || 0));
  const sizeLabel =
    stats.minArea == null
      ? "—"
      : stats.minArea === stats.maxArea
        ? formatArea(stats.minArea)
        : t("developments.range", { min: stats.minArea, max: formatArea(stats.maxArea) });
  const bedroomsLabel =
    stats.minBedrooms == null
      ? "—"
      : stats.minBedrooms === stats.maxBedrooms
        ? stats.minBedrooms
        : t("developments.range", { min: stats.minBedrooms, max: stats.maxBedrooms });

  return (
    <>
      <Seo
        title={`${development.name} — ${development.zone}`}
        description={development.tagline || development.description?.slice(0, 155)}
        image={seoImage}
      />

      <header className="dev-hero" style={development.hero_image ? { backgroundImage: `url("${development.hero_image}")` } : undefined}>
        <div className="dev-hero__shade" />
        <div className="container dev-hero__content">
          <span className="dev-hero__stage">{t(`developments.stage.${development.stage}`)}</span>
          <h1>{development.name}</h1>
          {development.tagline && <p className="dev-hero__tagline">{development.tagline}</p>}
          <p className="dev-hero__zone">{[development.zone, development.address].filter(Boolean).join(" · ")}</p>
        </div>
      </header>

      <div className="dev-provenance-wrap">
        <div className="container">
          <DevelopmentProvenance development={development} />
        </div>
      </div>

      <section className="container dev-stats" aria-label={development.name}>
        <Stat label={t("developments.stats.from")} value={stats.fromPrice != null ? formatMXN(stats.fromPrice) : "—"} />
        <Stat
          label={t("developments.stats.available")}
          value={stats.available}
          sub={t("developments.stats.availableOf", { total: stats.total })}
        />
        <Stat label={t("developments.stats.bedrooms")} value={bedroomsLabel} />
        <Stat label={t("developments.stats.area")} value={sizeLabel} />
        {development.delivery_date && <Stat label={t("developments.stats.delivery")} value={development.delivery_date} />}
      </section>

      {development.description && (
        <section className="container dev-intro">
          {development.description.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      )}

      <section className="section dev-section">
        <div className="container">
          <Reveal className="section-heading">
            <h2>{t("developments.sections.models")}</h2>
            <p>{t("developments.sections.modelsSubtitle")}</p>
          </Reveal>
          <div className="dev-models">
            {models.map(({ model, available, fromPrice }, index) => (
              <Reveal key={model.key} delay={(index % 4) * 70}>
                <article className="dev-model card">
                  <div className="dev-model__image">
                    {(model.images?.[0] || model.plan_image) && <img src={model.images?.[0] || model.plan_image} alt={model.name} loading="lazy" decoding="async" />}
                  </div>
                  <div className="dev-model__body">
                    <h3>{model.name}</h3>
                    <ul className="dev-specs">
                      {model.area_m2 != null && <li>{formatArea(model.area_m2)}</li>}
                      {model.bedrooms != null && <li>{t("developments.model.bedrooms", { count: model.bedrooms })}</li>}
                      {model.bathrooms != null && <li>{t("developments.model.bathrooms", { count: model.bathrooms })}</li>}
                      {model.parking != null && <li>{t("developments.model.parking", { count: model.parking })}</li>}
                    </ul>
                    {model.description && <p className="dev-model__text">{model.description}</p>}
                    <p className="dev-model__availability">
                      {available === 0
                        ? t("developments.model.none")
                        : available === 1
                          ? t("developments.model.availableOne")
                          : t("developments.model.available", { count: available })}
                      {fromPrice != null && <> · {t("developments.model.from", { price: formatMXN(fromPrice) })}</>}
                    </p>
                    {available > 0 && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => showModel(model.key)}>
                        {t("developments.model.see")}
                      </button>
                    )}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section dev-section dev-section--alt">
        <div className="container">
          <Reveal className="section-heading">
            <h2>{t("developments.sections.availability")}</h2>
            <p>{t("developments.sections.availabilitySubtitle")}</p>
          </Reveal>
          <AvailabilityMap development={development} selected={openNumber} onSelect={openUnitDialog} />
        </div>
      </section>

      <section className="section dev-section" id="departamentos">
        <div className="container">
          <Reveal className="section-heading">
            <h2>{t("developments.sections.units")}</h2>
          </Reveal>

          <div className="dev-filters card">
            <label>
              <span>{t("developments.filters.model")}</span>
              <select value={filters.model} onChange={(e) => updateFilters({ model: e.target.value })}>
                <option value="">{t("developments.filters.all")}</option>
                {development.models.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("developments.filters.bedrooms")}</span>
              <select value={filters.bedrooms} onChange={(e) => updateFilters({ bedrooms: e.target.value })}>
                <option value="">{t("developments.filters.all")}</option>
                {Array.from({ length: maxBedrooms }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {t("developments.filters.bedroomsMin", { count: n })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("developments.filters.floorFrom")}</span>
              <select value={filters.floorFrom} onChange={(e) => updateFilters({ floorFrom: e.target.value })}>
                <option value="">{t("developments.filters.all")}</option>
                {Array.from({ length: stats.floors }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("developments.filters.maxPrice")}</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="100000"
                placeholder={t("developments.filters.anyPrice")}
                value={filters.maxPrice}
                onChange={(e) => updateFilters({ maxPrice: e.target.value })}
              />
            </label>
            <label>
              <span>{t("developments.filters.sortBy")}</span>
              <select value={filters.sortBy} onChange={(e) => updateFilters({ sortBy: e.target.value })}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`developments.filters.sort.${option}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="dev-filters__check">
              <input
                type="checkbox"
                checked={filters.status === "disponible"}
                onChange={(e) => updateFilters({ status: e.target.checked ? "disponible" : "" })}
              />
              <span>{t("developments.filters.onlyAvailable")}</span>
            </label>
          </div>

          <div className="dev-results-bar">
            <span>{t(units.length === 1 ? "developments.results_one" : "developments.results_other", { count: units.length })}</span>
            {filtersActive && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => updateFilters({ ...EMPTY_UNIT_FILTERS })}>
                {t("developments.filters.clear")}
              </button>
            )}
          </div>

          {units.length === 0 ? (
            <p className="empty-state">{t("developments.noResults")}</p>
          ) : (
            <>
              <div className="dev-units">
                {units.slice(0, visible).map((unit) => (
                  <UnitCard key={unit.number} unit={unit} onOpen={openUnitDialog} t={t} />
                ))}
              </div>
              {units.length > visible && (
                <div className="dev-more">
                  <button type="button" className="btn btn-outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                    +{Math.min(PAGE_SIZE, units.length - visible)}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {(development.images?.length > 0 || development.amenities?.length > 0) && (
        <section className="section dev-section dev-section--alt">
          <div className="container dev-extra">
            {development.images?.length > 0 && (
              <div>
                <Gallery images={development.images} alt={development.name} />
              </div>
            )}
            {development.amenities?.length > 0 && (
              <div>
                <h2>{t("developments.sections.amenities")}</h2>
                <ul className="dev-amenities">
                  {development.amenities.map((amenity) => (
                    <li key={amenity}>{amenity}</li>
                  ))}
                </ul>
                {development.lat != null && development.lng != null && (
                  <>
                    <h2>{t("developments.sections.location")}</h2>
                    <p>{development.address}</p>
                    <a
                      className="btn btn-outline btn-sm"
                      href={`https://www.google.com/maps?q=${development.lat},${development.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("developments.map")}
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="section dev-cta">
        <div className="container dev-cta__inner">
          <div>
            <h2>{t("developments.contact.title", { name: development.name })}</h2>
            <p>{t("developments.contact.text")}</p>
          </div>
          <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            {t("developments.contact.whatsapp")}
          </a>
        </div>
      </section>

      <section className="container dev-disclaimer">
        <h3>{t("developments.disclaimer.title")}</h3>
        <p>{development.disclaimer || t("developments.disclaimer.default")}</p>
      </section>

      {openUnit && <UnitDialog development={development} unit={openUnit} onSelect={openUnitDialog} onClose={closeUnitDialog} />}
    </>
  );
}
