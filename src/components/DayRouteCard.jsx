import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildDayRoute, routeUrl } from "../lib/dayRoute";
import "./MyDayPanels.css";

// «Ruta de hoy» (Mi día): las visitas que faltan hoy como paradas en orden de hora, con un enlace que abre Google Maps
// con TODAS las escalas. Las paradas salen de las coordenadas de la propiedad o del lugar escrito en la cita. No carga
// ningún mapa ni llama a terceros hasta que se toca el enlace. `agenda`: salida de todayAgenda (`{ cita, state }`).
export default function DayRouteCard({ agenda, properties }) {
  const { t } = useTranslation();
  const route = useMemo(() => buildDayRoute(agenda, properties), [agenda, properties]);
  if (route.stops.length === 0 && route.unplaced.length === 0) return null;
  const url = routeUrl(route.stops);

  return (
    <section className="card day-panel" aria-labelledby="day-route-title">
      <h2 id="day-route-title">
        {t("dayRoute.title")} <span className="my-day__count">{route.stops.length}</span>
      </h2>
      <p className="form-hint">{t("dayRoute.hint")}</p>
      {route.stops.length > 0 && (
        <ol className="day-panel__list">
          {route.stops.map((stop, i) => (
            <li key={`${stop.query}-${i}`}>
              <span className="day-panel__num" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                {stop.hora && <strong>{stop.hora}</strong>} {stop.label}
              </span>
            </li>
          ))}
        </ol>
      )}
      {route.truncated > 0 && <p className="form-hint">{t("dayRoute.truncated", { count: route.truncated })}</p>}
      {route.unplaced.length > 0 && <p className="form-hint">{t("dayRoute.unplaced", { count: route.unplaced.length })}</p>}
      {url && (
        <a className="btn btn-primary btn-sm" href={url} target="_blank" rel="noopener noreferrer">
          {route.stops.length > 1 ? t("dayRoute.open") : t("dayRoute.openOne")}
        </a>
      )}
    </section>
  );
}
