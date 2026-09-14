import { useCallback, useMemo, useState } from "react";
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMXN, formatArea } from "../lib/format";
import "./PropertyMap.css";

const TYPE_COLORS = {
  casa: "#1565c0",
  departamento: "#2f9bdc",
  nave_industrial: "#0d3b73",
  terreno: "#1e8e5a",
};

const TYPE_SYMBOLS = {
  casa: "M3 11.5 12 4l9 7.5M5.5 9.8V20h5v-6h3v6h5V9.8",
  departamento: "M4 21V4h10v17M14 9h6v12M7 8h1M7 12h1M7 16h1M11 8h1M11 12h1M11 16h1M17 12h1M17 16h1",
  nave_industrial: "M3 21V11l5 3v-3l5 3v-3l5 3v7H3ZM6 21v-5M12 21v-5M18 21v-5",
  terreno: "M3 20h18M5 20V8h14v12M9 8V4h2v4M13 8V4h2v4",
};

// El divIcon de Leaflet (círculo de color + ícono del tipo) se vuelve un
// SVG en un data URI — Marker de Google Maps solo acepta una URL de
// imagen como icon, no un nodo HTML.
function markerSvg(type) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.casa;
  const path = TYPE_SYMBOLS[type] || TYPE_SYMBOLS.casa;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<circle cx="16" cy="16" r="14" fill="${color}" stroke="#fff" stroke-width="2"/>` +
    `<g transform="translate(8,8) scale(0.667)"><path d="${path}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>` +
    `</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const DEFAULT_CENTER = { lat: 25.5428, lng: -103.4068 };
const MAP_OPTIONS = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };
// Ajustar el mapa a los marcadores con fitBounds() puede terminar casi al
// máximo de zoom cuando solo hay un punto (o varios muy juntos, como en
// la ficha de una sola propiedad) — mismo tope que antes tenía Leaflet
// (maxZoom: 14) para que no abra pegado al edificio.
const MAX_FIT_ZOOM = 15;

export default function PropertyMap({ properties, height = 480 }) {
  const { t } = useTranslation();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded } = useJsApiLoader({ id: "acl-google-map-script", googleMapsApiKey: apiKey });
  const [activeId, setActiveId] = useState(null);

  const center = properties.length > 0 ? { lat: properties[0].lat, lng: properties[0].lng } : DEFAULT_CENTER;

  const onLoad = useCallback(
    (map) => {
      if (properties.length === 0) return;
      const bounds = new window.google.maps.LatLngBounds();
      properties.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, 40);
      window.google.maps.event.addListenerOnce(map, "bounds_changed", () => {
        if (map.getZoom() > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
      });
    },
    [properties]
  );

  const iconFor = useMemo(() => {
    if (!isLoaded) return () => undefined;
    return (type) => ({
      url: markerSvg(type),
      scaledSize: new window.google.maps.Size(32, 32),
      anchor: new window.google.maps.Point(16, 16),
    });
  }, [isLoaded]);

  if (!apiKey) {
    return (
      <div className="property-map property-map--empty" style={{ height }}>
        {t("detail.mapNotConfigured")}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="property-map property-map--empty" style={{ height }}>
        {t("common.loading")}
      </div>
    );
  }

  const activeProperty = properties.find((p) => p.id === activeId);

  return (
    <div className="property-map" style={{ height }}>
      <GoogleMap center={center} zoom={11} mapContainerStyle={{ height: "100%", width: "100%" }} onLoad={onLoad} options={MAP_OPTIONS}>
        {properties.map((property) => (
          <MarkerF
            key={property.id}
            position={{ lat: property.lat, lng: property.lng }}
            icon={iconFor(property.type)}
            onClick={() => setActiveId(property.id)}
          />
        ))}
        {activeProperty && (
          <InfoWindowF position={{ lat: activeProperty.lat, lng: activeProperty.lng }} onCloseClick={() => setActiveId(null)}>
            <div className="map-popup">
              <img src={activeProperty.main_image} alt={activeProperty.title} />
              <strong>{activeProperty.title}</strong>
              <span className="map-popup__price">{formatMXN(activeProperty.price)}</span>
              <span className="map-popup__area">{formatArea(activeProperty.area_m2)}</span>
              <Link to={`/propiedades/${activeProperty.id}`} className="btn btn-primary btn-sm">
                {t("properties.viewDetail")}
              </Link>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}
