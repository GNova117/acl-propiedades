import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildDayRoute, buildDaySheet, routeUrl } from "../lib/dayRoute";
import "./MyDayPanels.css";

// «Ruta de hoy» (Mi día): las visitas que faltan hoy como paradas en orden de hora, con un enlace que abre Google Maps
// con TODAS las escalas. Las paradas salen de las coordenadas de la propiedad o del lugar escrito en la cita. No carga
// ningún mapa ni llama a terceros hasta que se toca el enlace. `agenda`: salida de todayAgenda (`{ cita, state }`).
export default function DayRouteCard({ agenda, properties }) {
  const { t } = useTranslation();
  const route = useMemo(() => buildDayRoute(agenda, properties), [agenda, properties]);
  if (route.stops.length === 0 && route.unplaced.length === 0) return null;
  const url = routeUrl(route.stops);
  const sheet = buildDaySheet(agenda);

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
      {sheet.length > 0 && (
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()} style={{ marginLeft: url ? "0.5rem" : 0 }}>
            {t("dayRoute.print")}
          </button>
          {/* Solo al imprimir: la hoja del día (el resto de la pantalla se oculta, ver MyDayPanels.css). */}
          <div className="day-sheet" aria-hidden="true">
            <p className="day-sheet__title">{t("dayRoute.sheetTitle", { date: new Date().toLocaleDateString("es-MX", { dateStyle: "full" }) })}</p>
            <table>
              <thead>
                <tr>
                  <th>{t("dayRoute.sheet.time")}</th>
                  <th>{t("dayRoute.sheet.what")}</th>
                  <th>{t("dayRoute.sheet.where")}</th>
                  <th>{t("dayRoute.sheet.contact")}</th>
                  <th>{t("dayRoute.sheet.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {sheet.map((row) => (
                  <tr key={row.id}>
                    <td>{row.hora}</td>
                    <td>
                      <strong>{row.titulo}</strong>
                      {row.propiedad && <div>{row.propiedad}</div>}
                    </td>
                    <td>{row.direccion}</td>
                    <td>{row.contacto}</td>
                    <td>{row.notas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
