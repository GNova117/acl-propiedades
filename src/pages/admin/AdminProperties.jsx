import ResponsiveImg from "../../components/ResponsiveImg";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, formatArea, propertyTypeLabel } from "../../lib/format";
import { downloadFichaTecnicaPdf } from "../../lib/propertyFichaPdf";
import { exportToCsv } from "../../lib/csvExport";
import { useAuth } from "../../context/AuthContext";
import SocialPostModal from "../../components/SocialPostModal";
import PropertyProspectsModal from "../../components/PropertyProspectsModal";
import PropertyOffersModal from "../../components/PropertyOffersModal";
import PropertyContractModal from "../../components/PropertyContractModal";
import SavedViews from "../../components/SavedViews";
import SortableTh from "../../components/SortableTh";
import ColumnPicker from "../../components/ColumnPicker";
import { loadHiddenColumns, nextSort, saveHiddenColumns, sortRows, toggleColumn } from "../../lib/tableTools";
import { contractState } from "../../lib/contracts";
import { buildActivityIndex, stalledInfo, STALL_DAY_OPTIONS } from "../../lib/stalledProperties";
import SendPropertyModal from "../../components/SendPropertyModal";
import SelectionBuilder from "../../components/SelectionBuilder";
import PropertyQrModal from "../../components/PropertyQrModal";
import { matchingProspects } from "../../lib/prospectMatch";
import { isOpenStage } from "../../lib/prospects";
import BulkActionsBar from "../../components/BulkActionsBar";
import { propertyCompleteness } from "../../lib/propertyCompleteness";
import { bulkAdvisorIds, bulkPriceValue } from "../../lib/bulkProperties";
import AdminFilters from "../../components/AdminFilters";
import RowMore from "../../components/RowMore";
import { queries } from "../../lib/queries";
import { useQuery } from "../../lib/useQuery";
import "./admin.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog, notify } from "../../lib/toast";

// updateProperty espera el registro casi completo (no hace un merge parcial
// en el servidor) y, en particular, pisa fotos/videos/360° a [] si no se le
// pasan explícitos — así que un cambio en lote de un solo campo (estatus,
// activo) tiene que ir con todo lo demás de la propiedad, incluyendo los
// tres arreglos de medios ya existentes, para no perderlos.
const NONE = [];

function mediaPreservingPatch(property, patch) {
  return {
    ...property,
    ...patch,
    imageFiles: [],
    existingImages: property.images || [],
    videoFiles: [],
    existingVideos: property.videos || [],
    tour360Files: [],
    existingTour360Images: property.tour_360_images || [],
  };
}

// `fixedType`: apartado de un solo tipo (Naves Industriales) — la lista solo
// muestra propiedades de ese tipo y "Nueva" cae directo en ese tipo.
// `excludeTypes`: apartado general "Propiedades" — oculta los tipos que ya
// tienen su propio apartado, mismo criterio que la parte pública del sitio.
// Lo que guarda una vista de Propiedades (lib/savedViews.js).
const PROPERTY_VIEW_SCHEMA = { search: "string", zoneFilter: "string", operationFilter: "string", statusFilter: "string", minPrice: "string", maxPrice: "string", onlyIncomplete: "boolean", stallDays: "number" };

// Columnas de la tabla que se pueden ocultar (las demás —selección, foto, título y acciones— siempre se ven) y cómo se ordena
// cada una (lib/tableTools.js).
const HIDEABLE = ["code", "type", "zone", "price", "area", "status", "active"];
const SORT_BY = {
  code: (p) => p.code,
  title: (p) => p.title,
  type: (p) => p.type,
  zone: (p) => p.zone,
  price: (p) => (p.price == null ? null : Number(p.price)),
  area: (p) => (p.area_m2 == null ? null : Number(p.area_m2)),
  status: (p) => p.status,
  active: (p) => Boolean(p.active),
};

export default function AdminProperties({
  fixedType,
  excludeTypes = [],
  titleKey = "admin.properties",
  newLabelKey = "admin.newProperty",
  basePath = "/admin/propiedades",
}) {
  const { t } = useTranslation();
  const { hasSection, advisorId } = useAuth();
  const [busyFichaId, setBusyFichaId] = useState(null);
  const [socialProperty, setSocialProperty] = useState(null);
  const [matchProperty, setMatchProperty] = useState(null);
  const [offersProperty, setOffersProperty] = useState(null);
  const [contractProperty, setContractProperty] = useState(null);
  const [stallDays, setStallDays] = useState(0); // 0 = sin filtro
  const [sort, setSort] = useState(null);
  const tableKey = `propiedades:${basePath}`;
  const [hiddenCols, setHiddenCols] = useState(() => loadHiddenColumns(`propiedades:${basePath}`, HIDEABLE));
  const col = (key) => ({ "data-col": key, hidden: hiddenCols.has(key) || undefined });
  const changeColumns = (next) => {
    setHiddenCols(next);
    saveHiddenColumns(tableKey, next);
  };
  const [sendProperty, setSendProperty] = useState(null);
  const [buildingSelection, setBuildingSelection] = useState(false);
  const [qrProperty, setQrProperty] = useState(null);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [operationFilter, setOperationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("disponible");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [priceMode, setPriceMode] = useState("percentDown");
  const [priceAmount, setPriceAmount] = useState("");
  const [bulkAdvisor, setBulkAdvisor] = useState("");

  // Las listas salen del caché (ver dataCache.js): si ya se pidieron en otra pantalla, esta se pinta
  // al instante y se actualiza al llegar lo nuevo. Los prospectos solo se piden a quien tiene el apartado
  // (RLS: un asesor recibe solo los suyos).
  const propertiesQ = useQuery(queries.properties);
  const remodelQ = useQuery(queries.remodelProjects);
  const zonesQ = useQuery(queries.zones);
  const advisorsQ = useQuery(queries.advisors);
  const prospectsQ = useQuery(queries.prospects, { enabled: hasSection("prospectos") });
  const contractsQ = useQuery(queries.propertyContracts);
  // «Sin movimiento» solo se calcula con TODOS los datos (la oficina con esos apartados): un asesor solo ve lo suyo y
  // una propiedad parecería estancada sin estarlo.
  const canJudgeStalled = advisorId == null && hasSection("prospectos") && hasSection("agenda") && hasSection("visitas");
  const visitsQ = useQuery(queries.visits, { enabled: canJudgeStalled });
  const citasQ = useQuery(queries.citas, { enabled: canJudgeStalled });
  const remodelProjects = remodelQ.data ?? NONE;
  const zones = zonesQ.data ?? NONE;
  const advisors = advisorsQ.data ?? NONE;
  const prospects = prospectsQ.data ?? NONE;
  const loading = propertiesQ.loading;
  const properties = useMemo(() => {
    const all = propertiesQ.data ?? NONE;
    return fixedType ? all.filter((p) => p.type === fixedType) : all.filter((p) => !excludeTypes.includes(p.type));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertiesQ.data, fixedType]);
  // Tras cambiar una propiedad se vuelve a pedir la lista de propiedades.
  const load = () => propertiesQ.reload().catch(() => {});

  // A qué prospectos abiertos les encaja cada propiedad disponible.
  const prospectsByProperty = useMemo(() => new Map(properties.map((p) => [p.id, matchingProspects(p, prospects)])), [properties, prospects]);

  // Destinatarios posibles del botón "Enviar": prospectos abiertos, los más recientes primero.
  const openProspects = useMemo(
    () => prospects.filter((p) => isOpenStage(p.stage)).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))),
    [prospects]
  );

  // Qué tan completa está cada ficha y qué le falta (lib/propertyCompleteness.js).
  const contracts = useMemo(() => new Map((contractsQ.data ?? NONE).map((c) => [c.property_id, c])), [contractsQ.data]);
  const activityIndex = useMemo(
    () => (canJudgeStalled ? buildActivityIndex({ visits: visitsQ.data ?? NONE, citas: citasQ.data ?? NONE, prospects }) : null),
    [canJudgeStalled, visitsQ.data, citasQ.data, prospects]
  );
  const stalled = useMemo(
    () => new Map(properties.map((p) => [p.id, activityIndex ? stalledInfo(p, activityIndex, { days: stallDays || 30 }) : null])),
    [properties, activityIndex, stallDays]
  );
  const completeness = useMemo(() => new Map(properties.map((p) => [p.id, propertyCompleteness(p)])), [properties]);

  const visibleProperties = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = properties.filter((p) => {
      if (onlyIncomplete && completeness.get(p.id)?.complete) return false;
      if (stallDays && !stalled.get(p.id)?.stalled) return false;
      if (term && !p.title?.toLowerCase().includes(term) && !p.code?.toLowerCase().includes(term) && !p.address?.toLowerCase().includes(term)) return false;
      if (zoneFilter && p.zone !== zoneFilter) return false;
      if (operationFilter && p.operation_type !== operationFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (minPrice && Number(p.price) < Number(minPrice)) return false;
      if (maxPrice && Number(p.price) > Number(maxPrice)) return false;
      return true;
    });
    return sortRows(matching, sort, SORT_BY);
  }, [properties, completeness, onlyIncomplete, stallDays, stalled, search, zoneFilter, operationFilter, statusFilter, minPrice, maxPrice, sort]);

  const handleDelete = async (id) => {
    if (!await confirmDialog(t("common.confirmDelete"))) return;
    await db.deleteProperty(id);
    load();
  };

  const toggleActive = async (property) => {
    await db.updateProperty(property.id, { ...property, active: !property.active, imageFiles: [], existingImages: property.images });
    load();
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = visibleProperties.length > 0 && visibleProperties.every((p) => selected.has(p.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      visibleProperties.forEach((p) => (allVisibleSelected ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  };

  const selectedProperties = useMemo(() => properties.filter((p) => selected.has(p.id)), [properties, selected]);

  // Una por una, NO en paralelo: en modo demo (localStorage) updateProperty
  // lee el arreglo completo, lo modifica en memoria y lo vuelve a escribir
  // completo — dos llamadas a la vez (p. ej. Promise.all) se pisan entre sí
  // y la última en guardar revierte el cambio de la otra en silencio.
  const runBulk = async (fn, list = selectedProperties) => {
    setBulkBusy(true);
    let okCount = 0;
    let failed = false;
    try {
      for (const property of list) {
        try {
          await fn(property);
          okCount += 1;
        } catch {
          failed = true;
        }
      }
      if (failed) notify(t("bulkActions.someFailed"));
      if (okCount > 0) notify(t("bulkActions.done", { count: okCount }));
      setSelected(new Set());
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!await confirmDialog(t("bulkActions.deleteConfirm", { count: selected.size }))) return;
    runBulk((property) => db.deleteProperty(property.id));
  };

  const handleBulkActive = (active) => runBulk((property) => db.updateProperty(property.id, mediaPreservingPatch(property, { active })));

  const handleBulkStatus = () => runBulk((property) => db.updateProperty(property.id, mediaPreservingPatch(property, { status: bulkStatus })));

  // Cambio de precio en lote: se calcula el nuevo precio de cada una, se muestra un ejemplo y se pide confirmar.
  // Las que no se pueden calcular (sin precio, o el cambio no lo mueve) se omiten y se avisa.
  const handleBulkPrice = async () => {
    const plan = selectedProperties.map((property) => ({ property, ...bulkPriceValue(priceMode, priceAmount, property.price) }));
    const ready = plan.filter((e) => e.price != null);
    if (ready.length === 0) {
      notify(t(`bulkProperties.errors.${plan[0]?.error || "amount"}`));
      return;
    }
    const sample = ready[0];
    const skipped = plan.length - ready.length;
    const message = [
      t("bulkProperties.confirmPrice", { count: ready.length, title: sample.property.title, from: formatMXN(sample.property.price), to: formatMXN(sample.price) }),
      skipped > 0 ? t("bulkProperties.skipped", { count: skipped }) : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!await confirmDialog(message)) return;
    const newPrice = new Map(ready.map((e) => [e.property.id, e.price]));
    runBulk((property) => db.updateProperty(property.id, mediaPreservingPatch(property, { price: newPrice.get(property.id) })), ready.map((e) => e.property));
    setPriceAmount("");
  };

  // Asignar asesor en lote: «agregar» no quita a nadie; «reemplazar» deja solo a ese (se confirma).
  const handleBulkAdvisor = async (mode) => {
    const advisor = advisors.find((a) => a.id === bulkAdvisor);
    if (!advisor) return;
    const targets = selectedProperties.filter((p) => bulkAdvisorIds(mode, p.advisor_ids, advisor.id));
    if (targets.length === 0) {
      notify(t("bulkProperties.nothingToChange"));
      return;
    }
    if (mode === "replace" && !await confirmDialog(t("bulkProperties.confirmReplace", { name: advisor.name, count: targets.length }))) return;
    runBulk((property) => db.updateProperty(property.id, mediaPreservingPatch(property, { advisor_ids: bulkAdvisorIds(mode, property.advisor_ids, advisor.id) })), targets);
  };

  const handleExport = () => {
    exportToCsv(`${basePath.split("/").pop()}.csv`, visibleProperties, [
      { label: t("detail.code"), key: "code" },
      { label: "Título", key: "title" },
      { label: t("properties.type"), value: (p) => propertyTypeLabel(t, p.type) },
      { label: t("properties.operationType"), value: (p) => t(`propertyOperation.${p.operation_type}`) },
      { label: t("common.status"), value: (p) => t(`propertyStatus.${p.status}`) },
      { label: t("properties.zone"), key: "zone" },
      { label: "Dirección", key: "address" },
      { label: "Precio", key: "price" },
      { label: "Área m²", key: "area_m2" },
      { label: t("properties.bedrooms"), key: "bedrooms" },
      { label: t("properties.bathrooms"), key: "bathrooms" },
      { label: "Estacionamiento", key: "parking" },
      { label: t("common.active"), value: (p) => (p.active ? t("common.active") : t("common.inactive")) },
      { label: t("messages.date"), value: (p) => (p.created_at ? new Date(p.created_at).toLocaleDateString("es-MX") : "") },
    ]);
  };

  const handleDownloadFicha = async (property) => {
    setBusyFichaId(property.id);
    try {
      await downloadFichaTecnicaPdf(property, {
        typeLabel: propertyTypeLabel(t, property.type),
        statusLabel: t(`propertyStatus.${property.status}`),
      });
    } catch (err) {
      notify(err.message || "Error al generar la ficha técnica");
    } finally {
      setBusyFichaId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t(titleKey)}</h1>
        <div className="admin-header__actions">
          <Link to={`${basePath}/nueva`} className="btn btn-primary">
            {t(newLabelKey)}
          </Link>
          <button type="button" className="btn btn-outline" onClick={() => setBuildingSelection(true)}>
            {t("selection.list.new")}
          </button>
          <ColumnPicker
            columns={HIDEABLE.map((key) => ({ key, label: { code: t("detail.code"), type: t("properties.type"), zone: t("properties.zone"), price: "Precio", area: t("properties.area"), status: t("common.status"), active: t("common.active") }[key] }))}
            hidden={hiddenCols}
            onToggle={(key) => changeColumns(toggleColumn(hiddenCols, key, HIDEABLE))}
            onReset={() => changeColumns(new Set())}
          />
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={visibleProperties.length === 0}>
            {t("common.exportCsv")}
          </button>
        </div>
      </div>

      <SavedViews
        list="propiedades"
        schema={PROPERTY_VIEW_SCHEMA}
        defaults={{ stallDays: 0 }}
        current={{ search, zoneFilter, operationFilter, statusFilter, minPrice, maxPrice, onlyIncomplete, stallDays }}
        onApply={(f) => {
          setSearch(f.search ?? "");
          setZoneFilter(f.zoneFilter ?? "");
          setOperationFilter(f.operationFilter ?? "");
          setStatusFilter(f.statusFilter ?? "");
          setMinPrice(f.minPrice ?? "");
          setMaxPrice(f.maxPrice ?? "");
          setOnlyIncomplete(Boolean(f.onlyIncomplete));
          setStallDays(canJudgeStalled && STALL_DAY_OPTIONS.includes(f.stallDays) ? f.stallDays : 0);
        }}
      />
      <AdminFilters
        activeCount={[zoneFilter, operationFilter, statusFilter, minPrice, maxPrice, onlyIncomplete, stallDays].filter(Boolean).length}
        search={
          <div className="form-field">
            <label htmlFor="ap-search">{t("common.search")}</label>
            <input id="ap-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      >
        <div className="form-field">
          <label htmlFor="ap-zone">{t("properties.zone")}</label>
          <select id="ap-zone" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="">{t("hero.allZones")}</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.name}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ap-operation">{t("properties.operationType")}</label>
          <select id="ap-operation" value={operationFilter} onChange={(e) => setOperationFilter(e.target.value)}>
            <option value="">{t("hero.allOperations")}</option>
            <option value="compra">{t("propertyOperation.compra")}</option>
            <option value="renta">{t("propertyOperation.renta")}</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ap-status">{t("common.status")}</label>
          <select id="ap-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("properties.allStatus")}</option>
            <option value="disponible">{t("propertyStatus.disponible")}</option>
            <option value="apartada">{t("propertyStatus.apartada")}</option>
            <option value="vendida">{t("propertyStatus.vendida")}</option>
          <option value="rentada">{t("propertyStatus.rentada")}</option>
            <option value="rentada">{t("propertyStatus.rentada")}</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ap-min-price">{t("properties.minPrice")}</label>
          <input id="ap-min-price" type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="ap-max-price">{t("properties.maxPrice")}</label>
          <input id="ap-max-price" type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </div>
        {canJudgeStalled && (
          <div className="form-field">
            <label htmlFor="ap-stalled">{t("stalled.filter")}</label>
            <select id="ap-stalled" value={stallDays} onChange={(e) => setStallDays(Number(e.target.value))} title={t("stalled.hint")}>
              <option value={0}>{t("stalled.any")}</option>
              {STALL_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t("stalled.days", { count: d })}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="prospect-filters__check">
          <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} />
          {t("completeness.onlyIncomplete")}
        </label>
      </AdminFilters>

      <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())} busy={bulkBusy}>
        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={bulkBusy} aria-label={t("common.status")}>
          <option value="disponible">{t("propertyStatus.disponible")}</option>
          <option value="apartada">{t("propertyStatus.apartada")}</option>
          <option value="vendida">{t("propertyStatus.vendida")}</option>
          <option value="rentada">{t("propertyStatus.rentada")}</option>
        </select>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleBulkStatus} disabled={bulkBusy}>
          {t("bulkActions.applyStatus")}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleBulkActive(true)} disabled={bulkBusy}>
          {t("bulkActions.activateSelected")}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleBulkActive(false)} disabled={bulkBusy}>
          {t("bulkActions.deactivateSelected")}
        </button>
        <span className="bulk-actions-bar__group">
          <select value={priceMode} onChange={(e) => setPriceMode(e.target.value)} disabled={bulkBusy} aria-label={t("bulkProperties.priceLabel")}>
            {["percentDown", "percentUp", "exact"].map((mode) => (
              <option key={mode} value={mode}>
                {t(`bulkProperties.modes.${mode}`)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            className="bulk-actions-bar__amount"
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
            disabled={bulkBusy}
            placeholder={priceMode === "exact" ? "$" : "%"}
            aria-label={t("bulkProperties.amountLabel")}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={handleBulkPrice} disabled={bulkBusy || !priceAmount}>
            {t("bulkProperties.applyPrice")}
          </button>
        </span>
        <span className="bulk-actions-bar__group">
          <select value={bulkAdvisor} onChange={(e) => setBulkAdvisor(e.target.value)} disabled={bulkBusy} aria-label={t("bulkProperties.advisorLabel")}>
            <option value="">{t("bulkProperties.advisorPick")}</option>
            {advisors
              .filter((a) => a.active !== false)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleBulkAdvisor("add")} disabled={bulkBusy || !bulkAdvisor}>
            {t("bulkProperties.addAdvisor")}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleBulkAdvisor("replace")} disabled={bulkBusy || !bulkAdvisor}>
            {t("bulkProperties.replaceAdvisor")}
          </button>
        </span>
        <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={bulkBusy}>
          {t("bulkActions.deleteSelected")}
        </button>
      </BulkActionsBar>

      {/* En el teléfono cada fila es una tarjeta (ver admin-table--cards en admin.css). */}
      <div className="card admin-table-wrapper admin-table-wrapper--cards">
        <table className="admin-table admin-table--cards admin-table--properties">
          <thead>
            <tr>
              <th className="cell-select" data-label={t("bulkActions.selectAll")}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label={t("bulkActions.selectAll")} />
              </th>
              <th></th>
              <SortableTh column="code" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} colProps={col("code")}>
                {t("detail.code")}
              </SortableTh>
              <SortableTh column="title" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))}>
                Título
              </SortableTh>
              <SortableTh column="type" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} colProps={col("type")} className="cell-type">
                {t("properties.type")}
              </SortableTh>
              {fixedType === "nave_industrial" && <th className="cell-tipo">{t("properties.naveTipo")}</th>}
              <SortableTh column="zone" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} colProps={col("zone")}>
                {t("properties.zone")}
              </SortableTh>
              <SortableTh column="price" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} colProps={col("price")}>
                Precio
              </SortableTh>
              <SortableTh column="area" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} colProps={col("area")}>
                {t("properties.area")}
              </SortableTh>
              <SortableTh column="status" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} colProps={col("status")}>
                {t("common.status")}
              </SortableTh>
              <SortableTh column="active" sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} colProps={col("active")}>
                {t("common.active")}
              </SortableTh>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={fixedType === "nave_industrial" ? 12 : 11}><LoadingState variant="rows" /></td></tr>
            ) : visibleProperties.length === 0 ? (
              <tr><td colSpan={fixedType === "nave_industrial" ? 12 : 11}>{t("properties.noResults")}</td></tr>
            ) : (
              visibleProperties.map((property) => {
                const remodelProject = remodelProjects.find((r) => r.property_id === property.id);
                const matchedProspects = prospectsByProperty.get(property.id) || [];
                return (
                  <tr key={property.id} className="admin-row">
                    <td className="cell-select">
                      <input
                        type="checkbox"
                        checked={selected.has(property.id)}
                        onChange={() => toggleOne(property.id)}
                        aria-label={t("bulkActions.selectRow")}
                      />
                    </td>
                    <td className="cell-thumb">{property.main_image && <ResponsiveImg src={property.main_image} sizes="64px" alt="" />}</td>
                    <td className="cell-code" {...col("code")}>{property.code || "—"}</td>
                    <td className="cell-title">
                      {property.title}
                      {(property.advisor_ids || []).length === 0 && <span className="badge badge-reserved property-no-advisor">{t("properties.noAdvisor")}</span>}
                      {(() => {
                        const c = completeness.get(property.id);
                        if (!c) return null;
                        const missing = c.missing.map((key) => t(`completeness.items.${key}`)).join(", ");
                        return (
                          <div className={`property-completeness property-completeness--${c.complete ? "ok" : c.percent >= 50 ? "mid" : "low"}`} title={missing ? t("completeness.missing", { items: missing }) : t("completeness.complete")}>
                            <span className="property-completeness__bar" aria-hidden="true">
                              <span style={{ width: `${c.percent}%` }} />
                            </span>
                            <span>{t("completeness.label", { percent: c.percent })}</span>
                            {!c.complete && missing && <span className="form-hint property-completeness__missing">{t("completeness.missing", { items: missing })}</span>}
                          </div>
                        );
                      })()}
                      {(() => {
                        const contract = contracts.get(property.id);
                        const idle = stalled.get(property.id);
                        const cs = contract ? contractState(contract) : null;
                        if (!(cs && cs.state !== "vigente") && !idle?.stalled) return null;
                        return (
                          <div className="property-flags">
                            {cs && cs.state !== "vigente" && (
                              <span className={`prospect-chip prospect-chip--${cs.state === "vencido" ? "overdue" : "today"}`}>
                                {t("contract.chip", { kind: t(`contract.kinds.${contract.kind}`), state: t(`contract.states.${cs.state}`, { count: Math.abs(cs.daysLeft) }) })}
                              </span>
                            )}
                            {idle?.stalled && <span className="prospect-chip prospect-chip--overdue">{t("stalled.chip", { count: idle.daysIdle })}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="cell-type" {...col("type")}>{propertyTypeLabel(t, property.type)}</td>
                    {fixedType === "nave_industrial" && <td className="cell-tipo">{property.tipo_nave ? t(`naveTipo.${property.tipo_nave}`) : "—"}</td>}
                    <td className="cell-zone" {...col("zone")}>{property.zone}</td>
                    <td className="cell-price" {...col("price")}>{formatMXN(property.price)}</td>
                    <td className="cell-area" {...col("area")}>{formatArea(property.area_m2)}</td>
                    <td className="cell-status" {...col("status")}>{t(`propertyStatus.${property.status}`)}</td>
                    <td className="cell-active" {...col("active")}>
                      <button type="button" className={`badge ${property.active ? "badge-available" : "badge-sold"}`} onClick={() => toggleActive(property)}>
                        {property.active ? t("common.active") : t("common.inactive")}
                      </button>
                    </td>
                    <td className="admin-table__actions cell-actions">
                      <Link to={`${basePath}/${property.id}`} className="btn btn-outline btn-sm">
                        {t("common.edit")}
                      </Link>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setSendProperty(property)}>
                        {t("sendProperty.button")}
                      </button>
                      <RowMore>
                        <Link to={`${basePath}/nueva?duplicar=${property.id}`} className="btn btn-outline btn-sm">
                          {t("duplicate.button")}
                        </Link>
                        <Link to={`${basePath}/${property.id}/historial`} className="btn btn-outline btn-sm">
                          {t("propertyHistory.button")}
                        </Link>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDownloadFicha(property)}
                          disabled={busyFichaId === property.id}
                        >
                          {busyFichaId === property.id ? <span className="spinner" /> : null}
                          {t("admin.technicalSheet")}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setQrProperty(property)}>
                          {t("propertyQr.button")}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSocialProperty(property)}>
                          {t("socialPost.button")}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setContractProperty(property)}>
                          {t("contract.button")}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOffersProperty(property)}>
                          {t("offers.button")}
                        </button>
                        {matchedProspects.length > 0 && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setMatchProperty(property)}>
                            {t("prospects.match.propertyButton", { count: matchedProspects.length })}
                          </button>
                        )}
                        {remodelProject && hasSection("remodelaciones") && (
                          <Link to={`/admin/remodelaciones/${remodelProject.id}`} className="btn btn-outline btn-sm">
                            {t("remodelCalculator.button")}
                          </Link>
                        )}
                        {hasSection("liquidaciones") && (
                          <Link to={`/admin/propiedades/${property.id}/liquidacion`} className="btn btn-outline btn-sm">
                            {t("liquidacion.button")}
                          </Link>
                        )}
                        {hasSection("bitacora") && (
                          <Link to={`${basePath}/${property.id}/bitacora`} className="btn btn-outline btn-sm">
                            {t("propertyLog.button")}
                          </Link>
                        )}
                        {hasSection("visitas") && (
                          <Link to={`/admin/visitas/propiedad/${property.id}`} className="btn btn-outline btn-sm">
                            {t("visits.button")}
                          </Link>
                        )}
                        {hasSection("inspecciones") && (
                          <Link to={`/admin/inspecciones/nueva?propiedad=${property.id}`} className="btn btn-outline btn-sm">
                            {t("inspections.button")}
                          </Link>
                        )}
                        {hasSection("reportes") && property.status !== "vendida" && (
                          <Link to={`/admin/reportes?vender=${property.id}`} className="btn btn-outline btn-sm">
                            {t("salesReports.registerSale")}
                          </Link>
                        )}
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(property.id)}>
                          {t("common.delete")}
                        </button>
                      </RowMore>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {socialProperty && <SocialPostModal property={socialProperty} onClose={() => setSocialProperty(null)} />}
      {qrProperty && <PropertyQrModal property={qrProperty} onClose={() => setQrProperty(null)} />}
      {buildingSelection && <SelectionBuilder onClose={() => setBuildingSelection(false)} />}
      {sendProperty && (
        <SendPropertyModal
          property={sendProperty}
          prospects={openProspects}
          onClose={() => setSendProperty(null)}
          onLogged={(updated) => prospectsQ.mutate((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
        />
      )}
      {contractProperty && (
        <PropertyContractModal
          property={contractProperty}
          contract={contracts.get(contractProperty.id) || null}
          onClose={() => setContractProperty(null)}
          onChanged={() => contractsQ.reload().catch(() => {})}
        />
      )}
      {offersProperty && <PropertyOffersModal property={offersProperty} onClose={() => setOffersProperty(null)} onChanged={load} />}
      {matchProperty && (
        <PropertyProspectsModal property={matchProperty} prospects={prospectsByProperty.get(matchProperty.id) || []} onClose={() => setMatchProperty(null)} />
      )}
    </div>
  );
}
