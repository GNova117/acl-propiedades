import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, formatArea, propertyTypeLabel } from "../../lib/format";
import { downloadFichaTecnicaPdf } from "../../lib/propertyFichaPdf";
import { exportToCsv } from "../../lib/csvExport";
import { useAuth } from "../../context/AuthContext";
import SocialPostModal from "../../components/SocialPostModal";
import BulkActionsBar from "../../components/BulkActionsBar";
import "./admin.css";

// updateProperty espera el registro casi completo (no hace un merge parcial
// en el servidor) y, en particular, pisa fotos/videos/360° a [] si no se le
// pasan explícitos — así que un cambio en lote de un solo campo (estatus,
// activo) tiene que ir con todo lo demás de la propiedad, incluyendo los
// tres arreglos de medios ya existentes, para no perderlos.
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
export default function AdminProperties({
  fixedType,
  excludeTypes = [],
  titleKey = "admin.properties",
  newLabelKey = "admin.newProperty",
  basePath = "/admin/propiedades",
}) {
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const [properties, setProperties] = useState([]);
  const [remodelProjects, setRemodelProjects] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyFichaId, setBusyFichaId] = useState(null);
  const [socialProperty, setSocialProperty] = useState(null);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [operationFilter, setOperationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("disponible");

  const load = () => {
    setLoading(true);
    Promise.all([db.getProperties({}), db.getRemodelProjects({}), db.getZones().catch(() => [])]).then(([propertyData, remodelData, zoneData]) => {
      const filtered = fixedType
        ? propertyData.filter((p) => p.type === fixedType)
        : propertyData.filter((p) => !excludeTypes.includes(p.type));
      setProperties(filtered);
      setRemodelProjects(remodelData);
      setZones(zoneData);
      setLoading(false);
    });
  };

  useEffect(load, [fixedType]);

  const visibleProperties = useMemo(() => {
    const term = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (term && !p.title?.toLowerCase().includes(term) && !p.code?.toLowerCase().includes(term) && !p.address?.toLowerCase().includes(term)) return false;
      if (zoneFilter && p.zone !== zoneFilter) return false;
      if (operationFilter && p.operation_type !== operationFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (minPrice && Number(p.price) < Number(minPrice)) return false;
      if (maxPrice && Number(p.price) > Number(maxPrice)) return false;
      return true;
    });
  }, [properties, search, zoneFilter, operationFilter, statusFilter, minPrice, maxPrice]);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
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
  const runBulk = async (fn) => {
    setBulkBusy(true);
    let okCount = 0;
    let failed = false;
    try {
      for (const property of selectedProperties) {
        try {
          await fn(property);
          okCount += 1;
        } catch {
          failed = true;
        }
      }
      if (failed) window.alert(t("bulkActions.someFailed"));
      if (okCount > 0) window.alert(t("bulkActions.done", { count: okCount }));
      setSelected(new Set());
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!window.confirm(t("bulkActions.deleteConfirm", { count: selected.size }))) return;
    runBulk((property) => db.deleteProperty(property.id));
  };

  const handleBulkActive = (active) => runBulk((property) => db.updateProperty(property.id, mediaPreservingPatch(property, { active })));

  const handleBulkStatus = () => runBulk((property) => db.updateProperty(property.id, mediaPreservingPatch(property, { status: bulkStatus })));

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
      window.alert(err.message || "Error al generar la ficha técnica");
    } finally {
      setBusyFichaId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t(titleKey)}</h1>
        <div className="admin-header__actions">
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={visibleProperties.length === 0}>
            {t("common.exportCsv")}
          </button>
          <Link to={`${basePath}/nueva`} className="btn btn-primary">
            {t(newLabelKey)}
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1.25rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="form-field">
          <label htmlFor="ap-search">{t("common.search")}</label>
          <input id="ap-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
      </div>

      <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())} busy={bulkBusy}>
        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={bulkBusy} aria-label={t("common.status")}>
          <option value="disponible">{t("propertyStatus.disponible")}</option>
          <option value="apartada">{t("propertyStatus.apartada")}</option>
          <option value="vendida">{t("propertyStatus.vendida")}</option>
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
        <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={bulkBusy}>
          {t("bulkActions.deleteSelected")}
        </button>
      </BulkActionsBar>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label={t("bulkActions.selectAll")} />
              </th>
              <th></th>
              <th>{t("detail.code")}</th>
              <th>Título</th>
              <th>{t("properties.type")}</th>
              {fixedType === "nave_industrial" && <th>{t("properties.naveTipo")}</th>}
              <th>{t("properties.zone")}</th>
              <th>Precio</th>
              <th>{t("properties.area")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.active")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={fixedType === "nave_industrial" ? 12 : 11}>{t("common.loading")}</td></tr>
            ) : visibleProperties.length === 0 ? (
              <tr><td colSpan={fixedType === "nave_industrial" ? 12 : 11}>{t("properties.noResults")}</td></tr>
            ) : (
              visibleProperties.map((property) => {
                const remodelProject = remodelProjects.find((r) => r.property_id === property.id);
                return (
                  <tr key={property.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(property.id)}
                        onChange={() => toggleOne(property.id)}
                        aria-label={t("bulkActions.selectRow")}
                      />
                    </td>
                    <td><img src={property.main_image} alt="" /></td>
                    <td>{property.code || "—"}</td>
                    <td>{property.title}</td>
                    <td>{propertyTypeLabel(t, property.type)}</td>
                    {fixedType === "nave_industrial" && <td>{property.tipo_nave ? t(`naveTipo.${property.tipo_nave}`) : "—"}</td>}
                    <td>{property.zone}</td>
                    <td>{formatMXN(property.price)}</td>
                    <td>{formatArea(property.area_m2)}</td>
                    <td>{t(`propertyStatus.${property.status}`)}</td>
                    <td>
                      <button type="button" className={`badge ${property.active ? "badge-available" : "badge-sold"}`} onClick={() => toggleActive(property)}>
                        {property.active ? t("common.active") : t("common.inactive")}
                      </button>
                    </td>
                    <td className="admin-table__actions">
                      <Link to={`${basePath}/${property.id}`} className="btn btn-outline btn-sm">
                        {t("common.edit")}
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
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSocialProperty(property)}>
                        {t("socialPost.button")}
                      </button>
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {socialProperty && <SocialPostModal property={socialProperty} onClose={() => setSocialProperty(null)} />}
    </div>
  );
}
