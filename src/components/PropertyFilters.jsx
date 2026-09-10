import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { propertyTypeLabel } from "../lib/format";
import { db } from "../lib/dataStore";
import "./PropertyFilters.css";

const MIN_OPTIONS = ["1", "2", "3", "4", "5"];

export default function PropertyFilters({ filters, zones, typeOptions = [], showOperation = true, showNaveTipo = false, onChange, onClear }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [amenities, setAmenities] = useState([]);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [searchingCode, setSearchingCode] = useState(false);

  useEffect(() => {
    db.getAmenities().then(setAmenities).catch(() => setAmenities([]));
  }, []);

  const handle = (field) => (e) => onChange({ ...filters, [field]: e.target.value });

  const toggleAmenity = (key) => {
    const current = filters.amenities || [];
    onChange({
      ...filters,
      amenities: current.includes(key) ? current.filter((a) => a !== key) : [...current, key],
    });
  };

  const handleCodeSearch = async (e) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setSearchingCode(true);
    setCodeError(false);
    try {
      const found = await db.getPropertyByCode(codeInput);
      if (found) {
        navigate(`/propiedades/${found.id}`);
      } else {
        setCodeError(true);
      }
    } finally {
      setSearchingCode(false);
    }
  };

  return (
    <div className="property-filters card">
      <div className="property-filters__header">
        <h3>{t("properties.filters")}</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>
          {t("properties.clear")}
        </button>
      </div>

      <form className="form-field" onSubmit={handleCodeSearch}>
        <label htmlFor="filter-code">{t("properties.searchByCode")}</label>
        <div className="property-filters__code-row">
          <input
            id="filter-code"
            placeholder={t("properties.codePlaceholder")}
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              setCodeError(false);
            }}
          />
          <button type="submit" className="btn btn-outline btn-sm" disabled={searchingCode || !codeInput.trim()}>
            {t("properties.codeSearchButton")}
          </button>
        </div>
        {codeError && <span className="form-error">{t("properties.codeNotFound")}</span>}
      </form>

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

      {showNaveTipo && (
        <div className="form-field">
          <label htmlFor="filter-nave-tipo">{t("properties.naveTipo")}</label>
          <select id="filter-nave-tipo" value={filters.tipoNave} onChange={handle("tipoNave")}>
            <option value="">{t("hero.allTypes")}</option>
            <option value="A">{t("naveTipo.A")}</option>
            <option value="B">{t("naveTipo.B")}</option>
          </select>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="filter-zone">{t("properties.zone")}</label>
        <input id="filter-zone" list="property-filters-zones" value={filters.zone} onChange={handle("zone")} placeholder={t("hero.allZones")} />
        <datalist id="property-filters-zones">
          {zones.map((zone) => (
            <option key={zone.id} value={zone.name} />
          ))}
        </datalist>
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

      <details className="property-filters__more" open>
        <summary>{t("properties.moreFilters")}</summary>

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

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="filter-bedrooms">{t("properties.minBedrooms")}</label>
            <select id="filter-bedrooms" value={filters.minBedrooms} onChange={handle("minBedrooms")}>
              <option value="">—</option>
              {MIN_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-bathrooms">{t("properties.minBathrooms")}</label>
            <select id="filter-bathrooms" value={filters.minBathrooms} onChange={handle("minBathrooms")}>
              <option value="">—</option>
              {MIN_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-parking">{t("properties.minParking")}</label>
            <select id="filter-parking" value={filters.minParking} onChange={handle("minParking")}>
              <option value="">—</option>
              {MIN_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>
        </div>

        {amenities.length > 0 && (
          <div className="form-field">
            <label>{t("properties.amenities")}</label>
            <div className="property-filters__amenities">
              {amenities.map((amenity) => (
                <label key={amenity.id} className="property-filters__amenity">
                  <input
                    type="checkbox"
                    checked={(filters.amenities || []).includes(amenity.key)}
                    onChange={() => toggleAmenity(amenity.key)}
                  />
                  {amenity.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </details>
    </div>
  );
}
