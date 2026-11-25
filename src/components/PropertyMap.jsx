import ResponsiveImg from "./ResponsiveImg";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMXN, formatArea } from "../lib/format";
import "leaflet/dist/leaflet.css";
import "./PropertyMap.css";
import { propertyPath } from "../lib/propertyUrl.js";

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

const CLUSTER_ICON_CACHE = {};
function getClusterIcon(count) {
  if (!CLUSTER_ICON_CACHE[count]) {
    const size = count < 10 ? 36 : count < 50 ? 44 : 52;
    CLUSTER_ICON_CACHE[count] = L.divIcon({
      html: `<div class="map-cluster" style="width:${size}px;height:${size}px">${count}</div>`,
      className: "map-cluster-wrapper",
      iconSize: [size, size],
    });
  }
  return CLUSTER_ICON_CACHE[count];
}

// `suppress`: bandera compartida con AreaSearchButton para que el ajuste
// automático del mapa no se confunda con que la persona lo movió. `skip`: con
// una zona buscada el mapa no se reajusta a los resultados (la persona ya
// eligió dónde mirar).
function FitBounds({ properties, suppress, skip }) {
  const map = useMap();
  useEffect(() => {
    if (properties.length === 0 || skip) return;
    const bounds = L.latLngBounds(properties.map((p) => [p.lat, p.lng]));
    if (suppress) suppress.current = true;
    // Sin animación: el ajuste inicial no la necesita, y si el mapa se desmonta (p. ej. al volver al
    // listado) mientras la animación sigue, Leaflet toca un panel ya destruido y lanza
    // "Cannot read properties of undefined (reading '_leaflet_pos')".
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
    if (suppress) setTimeout(() => (suppress.current = false), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);
  return null;
}

// "Buscar en esta zona": aparece cuando la persona mueve o acerca el mapa y,
// al tocarlo, avisa los límites visibles para que el listado se quede solo con
// lo que hay ahí.
function AreaSearchButton({ onSearchArea, suppress }) {
  const { t } = useTranslation();
  const map = useMap();
  const [dirty, setDirty] = useState(false);
  useMapEvents({
    moveend: () => {
      if (!suppress.current) setDirty(true);
    },
  });
  if (!dirty) return null;
  return (
    <div
      className="map-area-search"
      ref={(el) => {
        if (el) {
          L.DomEvent.disableClickPropagation(el);
          L.DomEvent.disableScrollPropagation(el);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          const b = map.getBounds();
          setDirty(false);
          onSearchArea({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
        }}
      >
        {t("properties.searchThisArea")}
      </button>
    </div>
  );
}

// Agrupa los marcadores que caen a menos de CLUSTER_PIXEL_RADIUS px entre sí
// EN LA PANTALLA (no en grados de lat/lng, que no son a escala real) — así
// el agrupamiento se ve igual de apretado en cualquier zoom. Se recalcula
// solo al mover/hacer zoom, no en cada render.
const CLUSTER_PIXEL_RADIUS = 56;

function clusterByPixelDistance(map, properties) {
  const points = properties
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({ property: p, point: map.latLngToLayerPoint([p.lat, p.lng]) }));
  const used = new Array(points.length).fill(false);
  const groups = [];
  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    const group = [points[i].property];
    used[i] = true;
    for (let j = i + 1; j < points.length; j++) {
      if (used[j]) continue;
      if (points[i].point.distanceTo(points[j].point) <= CLUSTER_PIXEL_RADIUS) {
        group.push(points[j].property);
        used[j] = true;
      }
    }
    groups.push(group);
  }
  return groups;
}

function clusterCenter(properties) {
  const lat = properties.reduce((sum, p) => sum + p.lat, 0) / properties.length;
  const lng = properties.reduce((sum, p) => sum + p.lng, 0) / properties.length;
  return [lat, lng];
}

// Radio del círculo de una propiedad con ubicación aproximada: el punto guardado está a menos de ~350 m del real (ver la migración
// 0120), así que 500 m lo contiene siempre sin delatar la calle.
const APPROXIMATE_RADIUS_M = 500;

function PropertyPopup({ property }) {
  const { t } = useTranslation();
  return (
    <Popup>
      <div className="map-popup">
        {property.main_image && <ResponsiveImg src={property.main_image} sizes="240px" alt={property.title} loading="lazy" decoding="async" />}
        <strong>{property.title}</strong>
        <span className="map-popup__price">{formatMXN(property.price)}</span>
        <span className="map-popup__area">{formatArea(property.area_m2)}</span>
        <Link to={propertyPath(property)} className="btn btn-primary btn-sm">
          {t("properties.viewDetail")}
        </Link>
      </div>
    </Popup>
  );
}

function ClusteredMarkers({ properties }) {
  const { t } = useTranslation();
  const map = useMap();
  // Las de ubicación aproximada van como círculo (nunca como punto) y no se agrupan con las demás.
  const exact = properties.filter((p) => !p.location_approximate);
  const approximate = properties.filter((p) => p.location_approximate && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const [groups, setGroups] = useState(() => clusterByPixelDistance(map, exact));

  const recompute = () => setGroups(clusterByPixelDistance(map, exact));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(recompute, [properties]);
  useMapEvents({ zoomend: recompute, moveend: recompute });

  const circles = approximate.map((property) => (
    <Circle
      key={`approx-${property.id}`}
      center={[property.lat, property.lng]}
      radius={APPROXIMATE_RADIUS_M}
      pathOptions={{ color: TYPE_COLORS[property.type] || TYPE_COLORS.casa, fillOpacity: 0.2, weight: 2 }}
    >
      <PropertyPopup property={property} />
    </Circle>
  ));

  return [circles, ...groups.map((group, i) => {
    if (group.length === 1) {
      const property = group[0];
      return (
        <Marker key={property.id} position={[property.lat, property.lng]} icon={getIcon(property.type)} title={property.title} alt={property.title}>
          <PropertyPopup property={property} />
        </Marker>
      );
    }
    return (
      <Marker
        key={`cluster-${i}-${group.length}`}
        position={clusterCenter(group)}
        icon={getClusterIcon(group.length)}
        title={t("propertyMap.cluster", { count: group.length })}
        alt={t("propertyMap.cluster", { count: group.length })}
        eventHandlers={{
          click: () => {
            const bounds = L.latLngBounds(group.map((p) => [p.lat, p.lng]));
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
          },
        }}
      />
    );
  })];
}

function FullscreenButton({ fullscreen, onToggle }) {
  const { t } = useTranslation();
  const map = useMap();
  useEffect(() => {
    // Leaflet cachea el tamaño del contenedor: al cambiar entre tamaño
    // normal y pantalla completa hay que avisarle que vuelva a medir.
    const id = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(id);
  }, [fullscreen, map]);

  return (
    <button type="button" className="map-fullscreen-btn" onClick={onToggle}>
      {fullscreen ? t("properties.mapExitFullscreen") : t("properties.mapFullscreen")}
    </button>
  );
}

export default function PropertyMap({ properties, height = 480, onSearchArea, areaActive = false }) {
  const [fullscreen, setFullscreen] = useState(false);
  const suppressRef = useRef(false);
  const center = properties.length > 0 ? [properties[0].lat, properties[0].lng] : [25.5428, -103.4068];

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => e.key === "Escape" && setFullscreen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const map = (
    <div className={`property-map ${fullscreen ? "property-map--fullscreen" : ""}`} style={fullscreen ? undefined : { height }}>
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds properties={properties} suppress={suppressRef} skip={areaActive} />
        <ClusteredMarkers properties={properties} />
        {onSearchArea && <AreaSearchButton onSearchArea={onSearchArea} suppress={suppressRef} />}
        <FullscreenButton fullscreen={fullscreen} onToggle={() => setFullscreen((v) => !v)} />
      </MapContainer>
    </div>
  );

  // En pantalla completa se saca del flujo normal con un portal a <body>:
  // así no importa si algún ancestro de la página crea su propio stacking
  // context (position/transform/opacity) que le gane al z-index de aquí.
  return fullscreen ? createPortal(map, document.body) : map;
}
