import { useTranslation } from "react-i18next";
import { propertyTypeLabel } from "../lib/format";
import "./PropertyFilters.css";

export default function PropertyFilters({ filters, zones, typeOptions = [], showOperation = true, onChange, onClear }) {
  const { t } = useTranslation();

  const handle = (field) => (e) => onChange({ ...filters, [field]: e.target.value });

  return (
    <div className="property-filters card">
      <div className="property-filters__header">
        <h3>{t("properties.filters")}</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>
          {t("properties.clear")}
        </button>
      </div>

      {typeOptions.length > 0 && (
        <div className="form-field">
          <label htmlFor="filter-type">{t("properties.type")}</label>
          <select id="filter-type" value={filters.type} onChange={handle("type")}>
            <option value="">{t("hero.allTypes")}</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {propertyTypeLabel(t, type)}
              </option>
            ))}
          </select>
        </div>
      )}

      {showOperation && (
        <div className="form-field">
          <label htmlFor="filter-operation">{t("properties.operationType")}</label>
          <select id="filter-operation" value={filters.operationType} onChange={handle("operationType")}>
            <option value="">{t("hero.allOperations")}</option>
            <option value="compra">{t("propertyOperation.compra")}</option>
            <option value="renta">{t("propertyOperation.renta")}</option>
          </select>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="filter-zone">{t("properties.zone")}</label>
        <select id="filter-zone" value={filters.zone} onChange={handle("zone")}>
          <option value="">{t("hero.allZones")}</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.name}>
              {zone.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="filter-min-price">{t("properties.minPrice")}</label>
          <input id="filter-min-price" type="number" min="0" value={filters.minPrice} onChange={handle("minPrice")} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-max-price">{t("properties.maxPrice")}</label>
          <input id="filter-max-price" type="number" min="0" value={filters.maxPrice} onChange={handle("maxPrice")} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="filter-min-area">{t("properties.minArea")}</label>
          <input id="filter-min-area" type="number" min="0" value={filters.minArea} onChange={handle("minArea")} />
        </div>
        <div className="form-field">
          <label htmlFor="filter-max-area">{t("properties.maxArea")}</label>
          <input id="filter-max-area" type="number" min="0" value={filters.maxArea} onChange={handle("maxArea")} />
        </div>
      </div>
    </div>
  );
}
