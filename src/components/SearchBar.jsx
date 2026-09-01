import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { PROPERTY_TYPES } from "../lib/format";
import "./SearchBar.css";

export default function SearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState({ type: "", zone: "", minPrice: "", maxPrice: "" });

  useEffect(() => {
    db.getZones().then(setZones).catch(() => setZones([]));
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (form.type) params.set("tipo", form.type);
    if (form.zone) params.set("zona", form.zone);
    if (form.minPrice) params.set("min", form.minPrice);
    if (form.maxPrice) params.set("max", form.maxPrice);
    navigate(`/propiedades?${params.toString()}`);
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-bar__field">
        <label htmlFor="search-type">{t("hero.searchType")}</label>
        <select id="search-type" name="type" value={form.type} onChange={handleChange}>
          <option value="">{t("hero.allTypes")}</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`propertyType.${type}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="search-bar__field">
        <label htmlFor="search-zone">{t("hero.searchZone")}</label>
        <select id="search-zone" name="zone" value={form.zone} onChange={handleChange}>
          <option value="">{t("hero.allZones")}</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.name}>
              {zone.name}
            </option>
          ))}
        </select>
      </div>

      <div className="search-bar__field">
        <label htmlFor="search-min">{t("hero.searchMin")}</label>
        <input id="search-min" name="minPrice" type="number" min="0" placeholder="$0" value={form.minPrice} onChange={handleChange} />
      </div>

      <div className="search-bar__field">
        <label htmlFor="search-max">{t("hero.searchMax")}</label>
        <input id="search-max" name="maxPrice" type="number" min="0" placeholder="$10,000,000" value={form.maxPrice} onChange={handleChange} />
      </div>

      <button type="submit" className="btn btn-primary search-bar__submit">
        {t("hero.searchButton")}
      </button>
    </form>
  );
}
