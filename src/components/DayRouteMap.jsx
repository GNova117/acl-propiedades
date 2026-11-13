import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";
import "./DayRoute.css";

const iconCache = new Map();
function numberIcon(number) {
  if (!iconCache.has(number)) {
    iconCache.set(
      number,
      L.divIcon({
        html: `<div class="day-route__pin">${number}</div>`,
        className: "day-route__pin-wrapper",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    );
  }
  return iconCache.get(number);
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    // Sin animación: si el mapa se desmonta durante el ajuste, Leaflet toca un panel ya destruido (mismo cuidado que PropertyMap).
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15, animate: false });
  }, [map, points]);
  return null;
}

// Mapa de la ruta de hoy (solo pantalla ancha, ver DayRoute.jsx): cada parada con su número y una línea que las une en orden.
// Solo se dibujan las paradas con ubicación exacta (las de propiedades con lat/lng).
export default function DayRouteMap({ stops }) {
  const { t } = useTranslation();
  const pinned = stops.filter((s) => s.pin);
  if (pinned.length === 0) return null;
  const points = pinned.map((s) => [s.pin.lat, s.pin.lng]);
  return (
    <div className="day-route__map" role="img" aria-label={t("dayRoute.mapLabel")}>
      <MapContainer center={points[0]} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.length > 1 && <Polyline positions={points} pathOptions={{ color: "#0d3b73", weight: 3, opacity: 0.7, dashArray: "6 6" }} />}
        {pinned.map((stop) => (
          <Marker key={stop.cita.id} position={[stop.pin.lat, stop.pin.lng]} icon={numberIcon(stop.number)} title={`${t("dayRoute.stop", { number: stop.number })}: ${stop.cita.titulo}`} keyboard={false} />
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
