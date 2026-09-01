import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMXN, formatArea } from "../lib/format";
import "leaflet/dist/leaflet.css";
import "./PropertyMap.css";

const TYPE_COLORS = {
  casa: "#1565c0",
  departamento: "#2f9bdc",
  nave_industrial: "#0d3b73",
};

const TYPE_SYMBOLS = {
  casa: "M3 11.5 12 4l9 7.5M5.5 9.8V20h5v-6h3v6h5V9.8",
  departamento: "M4 21V4h10v17M14 9h6v12M7 8h1M7 12h1M7 16h1M11 8h1M11 12h1M11 16h1M17 12h1M17 16h1",
  nave_industrial: "M3 21V11l5 3v-3l5 3v-3l5 3v7H3ZM6 21v-5M12 21v-5M18 21v-5",
};

function buildIcon(type) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.casa;
  const path = TYPE_SYMBOLS[type] || TYPE_SYMBOLS.casa;
  const html = `
    <div class="map-marker" style="background:${color}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="${path}" />
      </svg>
    </div>`;
  return L.divIcon({
    html,
    className: "map-marker-wrapper",
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -28],
  });
}

const ICON_CACHE = {};
function getIcon(type) {
  if (!ICON_CACHE[type]) ICON_CACHE[type] = buildIcon(type);
  return ICON_CACHE[type];
}

function FitBounds({ properties }) {
  const map = useMap();
  useEffect(() => {
    if (properties.length === 0) return;
    const bounds = L.latLngBounds(properties.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [properties, map]);
  return null;
}

export default function PropertyMap({ properties, height = 480 }) {
  const { t } = useTranslation();
  const center = properties.length > 0 ? [properties[0].lat, properties[0].lng] : [25.5428, -103.4068];

  return (
    <div className="property-map" style={{ height }}>
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds properties={properties} />
        {properties.map((property) => (
          <Marker key={property.id} position={[property.lat, property.lng]} icon={getIcon(property.type)}>
            <Popup>
              <div className="map-popup">
                <img src={property.main_image} alt={property.title} />
                <strong>{property.title}</strong>
                <span className="map-popup__price">{formatMXN(property.price)}</span>
                <span className="map-popup__area">{formatArea(property.area_m2)}</span>
                <Link to={`/propiedades/${property.id}`} className="btn btn-primary btn-sm">
                  {t("properties.viewDetail")}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
