import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_ROUTE_STOPS } from "../lib/dayRoute";
import "./DayRoute.css";

// El mapa (Leaflet) solo se descarga en pantalla ancha y cuando hay ruta.
const DayRouteMap = lazy(() => import("./DayRouteMap"));
const WIDE = "(min-width: 861px)";
const hm = (hora) => String(hora).slice(0, 5);

function useWideScreen() {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia(WIDE);
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}

// «Ruta de hoy» (Mi día): las citas que faltan, en orden de hora, con el botón que abre la ruta completa en Google Maps, el tramo
// entre una y otra y un aviso cuando no alcanza el tiempo. En pantalla ancha, además, el mapa con las paradas numeradas.
// `plan`: lo que devuelve planDayRoute() (lib/dayRoute.js). Con menos de dos paradas no hay ruta que mostrar.
export default function DayRoute({ plan }) {
  const { t } = useTranslation();
  const wide = useWideScreen();
  if (plan.stops.length < 2) return null;
  const hasMap = wide && plan.stops.some((s) => s.pin);

  const legNote = (leg) => {
    if (!leg || leg.level == null) return null;
    if (leg.gap < 0) return t("dayRoute.overlap");
    return t(leg.level === "late" ? "dayRoute.late" : "dayRoute.tight", { gap: leg.gap, minutes: leg.minutes });
  };

  return (
    <section className="my-day__section day-route" aria-labelledby="my-day-route">
      <h2 id="my-day-route">
        {t("dayRoute.title")} <span className="my-day__count">{plan.stops.length}</span>
      </h2>
      <p className="form-hint">{t("dayRoute.hint")}</p>

      <div className={`day-route__layout${hasMap ? " day-route__layout--map" : ""}`}>
        <div className="day-route__main">
          <div className="day-route__bar card">
            <div>
              <strong>{t("dayRoute.stops", { count: plan.stops.length })}</strong>
              {plan.totalKm > 0 && <span className="form-hint"> · {t("dayRoute.totalKm", { km: plan.totalKm })}</span>}
            </div>
            <a className="btn btn-primary btn-sm" href={plan.url} target="_blank" rel="noopener noreferrer">
              {t("dayRoute.open")}
            </a>
          </div>

          <ol className="day-route__stops">
            {plan.stops.map((stop) => {
              const note = legNote(stop.leg);
              return (
                <li key={stop.cita.id} className="day-route__stop">
                  {stop.leg && (
                    <p className={`day-route__leg${stop.leg.level ? ` day-route__leg--${stop.leg.level}` : ""}`}>
                      <span>{t("dayRoute.leg", { km: stop.leg.km, minutes: stop.leg.minutes })}</span>
                      {note && <strong role="status"> — {note}</strong>}
                    </p>
                  )}
                  <div className="day-route__row">
                    <span className="day-route__number" aria-label={t("dayRoute.stop", { number: stop.number })}>
                      {stop.number}
                    </span>
                    <div className="day-route__text">
                      <div className="day-route__headline">
                        <strong>{stop.cita.hora ? hm(stop.cita.hora) : t("dayRoute.allDay")}</strong> <span>{stop.cita.titulo}</span>
                      </div>
                      {stop.label && <p className="form-hint">📍 {stop.label}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {plan.unplaced.length > 0 && (
            <p className="form-hint day-route__note" role="status">
              {t("dayRoute.unplaced", { count: plan.unplaced.length, titles: plan.unplaced.map((i) => i.cita.titulo).join(", ") })}
            </p>
          )}
          {plan.truncated && <p className="form-hint day-route__note">{t("dayRoute.truncated", { max: MAX_ROUTE_STOPS })}</p>}
          <p className="form-hint day-route__note">{t("dayRoute.estimate")}</p>
        </div>

        {hasMap && (
          <Suspense fallback={<div className="day-route__map day-route__map--loading" />}>
            <DayRouteMap stops={plan.stops} />
          </Suspense>
        )}
      </div>
    </section>
  );
}
