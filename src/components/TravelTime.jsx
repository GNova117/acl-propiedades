import { useState } from "react";
import { useTranslation } from "react-i18next";
import { searchAddress } from "../lib/geocode";
import { formatDuration, readSavedPlace, savePlace, shortPlaceLabel, travelTimeBetween } from "../lib/travelTime";
import { hasCoordinates } from "../lib/mapLinks";
import "./TravelTime.css";

// «¿Cuánto tardas desde tu trabajo?» en la ficha. Se calcula solo al tocar «Calcular» (la búsqueda de
// direcciones no admite autocompletado) y el lugar se recuerda en este dispositivo para las demás fichas.
// Ver src/lib/travelTime.js para cómo se calcula y qué sale a internet.
export default function TravelTime({ property }) {
  const { t } = useTranslation();
  const [place, setPlace] = useState(readSavedPlace);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null); // { minutes, km, source } del lugar y propiedad actuales
  const [status, setStatus] = useState("idle"); // idle | loading | notFound | error
  const [calculatedFor, setCalculatedFor] = useState(null);

  if (!hasCoordinates(property)) return null;

  const compute = async (target) => {
    setStatus("loading");
    try {
      const travel = await travelTimeBetween(target, { lat: Number(property.lat), lng: Number(property.lng) });
      setResult(travel);
      setCalculatedFor(property.id);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = query.trim();
    if (text.length < 3) return;
    setStatus("loading");
    try {
      const [found] = await searchAddress(text);
      if (!found || !Number.isFinite(found.lat) || !Number.isFinite(found.lng)) {
        setStatus("notFound");
        return;
      }
      const next = { label: shortPlaceLabel(found.label) || text, lat: found.lat, lng: found.lng };
      setPlace(next);
      savePlace(next);
      await compute(next);
    } catch {
      setStatus("error");
    }
  };

  const clear = () => {
    setPlace(null);
    setResult(null);
    setCalculatedFor(null);
    setQuery("");
    setStatus("idle");
    savePlace(null);
  };

  const duration = result && calculatedFor === property.id ? formatDuration(result.minutes) : null;
  const durationText = duration
    ? duration.hours > 0
      ? t("travelTime.hoursMinutes", { hours: duration.hours, minutes: duration.minutes })
      : t("travelTime.minutes", { minutes: duration.minutes })
    : "";

  return (
    <div className="card travel-time">
      <strong>{t("travelTime.title")}</strong>

      {place ? (
        <div className="travel-time__result" aria-live="polite">
          <p className="travel-time__place">
            {t("travelTime.from", { place: place.label })}{" "}
            <button type="button" className="travel-time__link" onClick={clear}>
              {t("travelTime.change")}
            </button>
          </p>
          {duration ? (
            <p className="travel-time__duration">
              <strong>{result.source === "estimate" ? t("travelTime.approx", { duration: durationText }) : durationText}</strong>
              <span>{t("travelTime.byCar", { km: result.km.toFixed(1) })}</span>
            </p>
          ) : status === "loading" ? (
            <p className="form-hint">{t("travelTime.calculating")}</p>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => compute(place)}>
              {t("travelTime.calculate")}
            </button>
          )}
          {duration && result.source === "estimate" && <p className="form-hint">{t("travelTime.estimateNote")}</p>}
        </div>
      ) : (
        <form className="travel-time__form" onSubmit={handleSubmit}>
          <label htmlFor={`travel-${property.id}`} className="form-hint">{t("travelTime.prompt")}</label>
          <div className="travel-time__row">
            <input
              id={`travel-${property.id}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("travelTime.placeholder")}
              maxLength={120}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-outline btn-sm" disabled={status === "loading" || query.trim().length < 3}>
              {status === "loading" ? <span className="spinner" /> : null}
              {t("travelTime.calculate")}
            </button>
          </div>
          {status === "notFound" && <span className="form-error" role="alert">{t("travelTime.notFound")}</span>}
          {status === "error" && <span className="form-error" role="alert">{t("travelTime.error")}</span>}
          <p className="form-hint travel-time__privacy">{t("travelTime.privacy")}</p>
        </form>
      )}
      {place && status === "error" && <span className="form-error" role="alert">{t("travelTime.error")}</span>}
    </div>
  );
}
