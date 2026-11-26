import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { propertyListPath, propertyTypeLabel } from "../lib/format";
import "./SearchBar.css";
import { propertyPath } from "../lib/propertyUrl.js";

const LAST_SEARCH_KEY = "acl_last_search";
const EMPTY_SEARCH = { type: "", zone: "", minPrice: "", maxPrice: "" };

function readLastSearch() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_SEARCH_KEY) || "null");
    if (!saved || typeof saved !== "object") return EMPTY_SEARCH;
    return Object.fromEntries(Object.keys(EMPTY_SEARCH).map((key) => [key, typeof saved[key] === "string" || typeof saved[key] === "number" ? String(saved[key]) : ""]));
  } catch {
    return EMPTY_SEARCH;
  }
}

function rememberSearch(form) {
  try {
    localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(form));
  } catch {
    /* sin almacenamiento: simplemente no se recuerda */
  }
}

export default function SearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  // La última búsqueda se recuerda en este navegador: quien vuelve al inicio la encuentra puesta.
  const [form, setForm] = useState(readLastSearch);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [searchingCode, setSearchingCode] = useState(false);

  useEffect(() => {
    db.getZones().then(setZones).catch(() => setZones([]));
    db.getPropertyTypes().then(setPropertyTypes).catch(() => setPropertyTypes([]));
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const path = propertyListPath(form.type);
    const params = new URLSearchParams();
    // El tipo solo va como parámetro de URL en /propiedades (casa/departamento
    // conviven ahí); en los apartados de un solo tipo ya está implícito.
    if (form.type && path === "/propiedades") params.set("tipo", form.type);
    if (form.zone) params.set("zona", form.zone);
    // Si el mínimo quedó mayor que el máximo se acomodan (con los dos al revés no había resultados y sin explicación).
    let { minPrice, maxPrice } = form;
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) [minPrice, maxPrice] = [maxPrice, minPrice];
    if (minPrice) params.set("min", minPrice);
    if (maxPrice) params.set("max", maxPrice);
    const query = params.toString();
    rememberSearch({ ...form, minPrice: minPrice || "", maxPrice: maxPrice || "" });
    navigate(query ? `${path}?${query}` : path);
  };

  const handleCodeSearch = async (e) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setSearchingCode(true);
    setCodeError(false);
    try {
      const found = await db.getPropertyByCode(codeInput);
      if (found) {
        navigate(propertyPath(found));
      } else {
        setCodeError(true);
      }
    } catch (err) {
      // Sin red el botón se quedaba en «buscando»: ahora avisa que no se pudo buscar.
      console.error("getPropertyByCode", err);
      setCodeError("network");
    } finally {
      setSearchingCode(false);
    }
  };

  return (
    <div>
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-bar__field">
          <label htmlFor="search-type">{t("hero.searchType")}</label>
          <select id="search-type" name="type" value={form.type} onChange={handleChange}>
            <option value="">{t("hero.allTypes")}</option>
            {propertyTypes.map((pt) => (
              <option key={pt.id} value={pt.key}>
                {propertyTypeLabel(t, pt.key)}
              </option>
            ))}
          </select>
        </div>

        <div className="search-bar__field">
          <label htmlFor="search-zone">{t("hero.searchZone")}</label>
          <input id="search-zone" name="zone" list="search-bar-zones" value={form.zone} onChange={handleChange} placeholder={t("hero.allZones")} />
          <datalist id="search-bar-zones">
            {zones.map((zone) => (
              <option key={zone.id} value={zone.name} />
            ))}
          </datalist>
        </div>

        <div className="search-bar__field">
          <label htmlFor="search-min">{t("hero.searchMin")}</label>
          <input id="search-min" name="minPrice" type="number" min="0" placeholder="$0" value={form.minPrice} onChange={handleChange} />
        </div>

        <div className="search-bar__field">
          <label htmlFor="search-max">{t("hero.searchMax")}</label>
          <input id="search-max" name="maxPrice" type="number" min="0" placeholder={t("hero.maxPricePlaceholder")} value={form.maxPrice} onChange={handleChange} />
        </div>

        <button type="submit" className="btn btn-primary search-bar__submit">
          {t("hero.searchButton")}
        </button>
      </form>

      <form className="search-bar__code" onSubmit={handleCodeSearch}>
        <label htmlFor="search-code">{t("properties.searchByCode")}</label>
        <input
          id="search-code"
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
        {codeError && <span className="form-error">{t(codeError === "network" ? "properties.codeSearchError" : "properties.codeNotFound")}</span>}
      </form>
    </div>
  );
}
