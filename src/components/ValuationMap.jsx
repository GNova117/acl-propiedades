import { Fragment, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, LayersControl, Polygon, Polyline, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import { polygonAreaM2 } from "../lib/geoArea";
import { searchAddress } from "../lib/geocode";
import { formatArea } from "../lib/format";
import "leaflet/dist/leaflet.css";
import "./ValuationMap.css";

// Mismos colores que PropertyMap usa para terreno/casa, para que el asesor los
// reconozca. Cada figura además dice su tipo en texto (no solo por color). Si
// se cambian, cambiar también las muestras en ValuationMap.css/AdminValuation.css.
const SHAPE_COLORS = { land: "#1e8e5a", built: "#1565c0" };
const DEFAULT_CENTER = [25.5428, -103.4068]; // Torreón
const newId = () => Math.random().toString(36).slice(2, 10);

const VERTEX_ICONS = {
  land: L.divIcon({ className: "valuation-vertex valuation-vertex--land", iconSize: [14, 14], iconAnchor: [7, 7] }),
  built: L.divIcon({ className: "valuation-vertex valuation-vertex--built", iconSize: [14, 14], iconAnchor: [7, 7] }),
};

function DrawClicks({ active, onAdd }) {
  useMapEvents({
    click(e) {
      if (active) onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
  }, [target, map]);
  return null;
}

// `shapes`: [{ id, kind: "land" | "built", points: [[lat, lng], ...], levels }].
// El estado de las figuras vive en el padre (para sumar m² y valuar); aquí solo
// se guarda lo efímero: el modo de dibujo, la figura a medias y la búsqueda.
export default function ValuationMap({ shapes, onShapesChange }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState(null); // null | "land" | "built"
  const [draft, setDraft] = useState([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ status: "idle", results: [] });
  const [flyTarget, setFlyTarget] = useState(null);
  const searchAbort = useRef(null);

  useEffect(() => () => searchAbort.current?.abort(), []);

  const drawing = mode !== null;
  const kindLabel = (kind) => t(kind === "land" ? "valuation.kindLand" : "valuation.kindBuilt");

  const startDrawing = (kind) => {
    setMode(kind);
    setDraft([]);
  };
  const cancelDrawing = () => {
    setMode(null);
    setDraft([]);
  };
  const finishDrawing = () => {
    if (draft.length < 3) return;
    onShapesChange([...shapes, { id: newId(), kind: mode, points: draft, levels: 1 }]);
    cancelDrawing();
  };

  const moveVertex = (shapeId, index, latlng) => {
    onShapesChange(
      shapes.map((shape) =>
        shape.id === shapeId
          ? { ...shape, points: shape.points.map((p, i) => (i === index ? [latlng.lat, latlng.lng] : p)) }
          : shape
      )
    );
  };

  const goTo = (result) => {
    setFlyTarget({ lat: result.lat, lng: result.lng, zoom: 19 });
    setSearch({ status: "idle", results: [] });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearch({ status: "loading", results: [] });
    try {
      const results = await searchAddress(query, { signal: controller.signal });
      if (results.length === 1) {
        goTo(results[0]);
      } else {
        setSearch({ status: "done", results });
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setSearch({ status: "error", results: [] });
    }
  };

  const draftColor = SHAPE_COLORS[mode] || SHAPE_COLORS.land;
  const canClose = draft.length >= 3;

  return (
    <div className="valuation-map">
      <form className="valuation-map__search" onSubmit={handleSearch} role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("valuation.map.searchPlaceholder")}
          aria-label={t("valuation.map.searchPlaceholder")}
        />
        <button type="submit" className="btn btn-outline btn-sm" disabled={search.status === "loading" || !query.trim()}>
          {search.status === "loading" ? t("valuation.map.searching") : t("valuation.map.search")}
        </button>
      </form>

      {search.status === "error" && <p className="valuation-map__msg valuation-map__msg--error">{t("valuation.map.searchError")}</p>}
      {search.status === "done" && search.results.length === 0 && <p className="valuation-map__msg">{t("valuation.map.noResults")}</p>}
      {search.results.length > 1 && (
        <ul className="valuation-map__results">
          {search.results.map((result) => (
            <li key={result.id}>
              <button type="button" onClick={() => goTo(result)}>
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="valuation-map__toolbar">
        {!drawing ? (
          <>
            <button type="button" className="btn btn-outline btn-sm valuation-kind valuation-kind--land" onClick={() => startDrawing("land")}>
              {t("valuation.map.drawLand")}
            </button>
            <button type="button" className="btn btn-outline btn-sm valuation-kind valuation-kind--built" onClick={() => startDrawing("built")}>
              {t("valuation.map.drawBuilt")}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={finishDrawing} disabled={!canClose}>
              {t("valuation.map.finish")}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft((prev) => prev.slice(0, -1))} disabled={draft.length === 0}>
              {t("valuation.map.undo")}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={cancelDrawing}>
              {t("valuation.map.cancel")}
            </button>
            {canClose && (
              <span className="valuation-map__live">
                {t("valuation.map.currentArea")}: <strong>{formatArea(Math.round(polygonAreaM2(draft)))}</strong>
              </span>
            )}
          </>
        )}
      </div>
      <p className="form-hint">
        {drawing ? t("valuation.map.hintDrawing", { kind: kindLabel(mode).toLowerCase() }) : t("valuation.map.hintIdle")}
      </p>

      <div className={`valuation-map__canvas${drawing ? " is-drawing" : ""}`}>
        <MapContainer center={DEFAULT_CENTER} zoom={13} maxZoom={20} scrollWheelZoom doubleClickZoom={false} style={{ height: "100%", width: "100%" }}>
          {/* key: Leaflet fija los nombres de las capas al crear el control. */}
          <LayersControl key={i18n.language} position="topright">
            <LayersControl.BaseLayer checked name={t("valuation.map.satellite")}>
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={19}
                maxZoom={20}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name={t("valuation.map.streets")}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxNativeZoom={19}
                maxZoom={20}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <FlyTo target={flyTarget} />
          <DrawClicks active={drawing} onAdd={(point) => setDraft((prev) => [...prev, point])} />

          {shapes.map((shape) => {
            const color = SHAPE_COLORS[shape.kind];
            return (
              <Fragment key={shape.id}>
                <Polygon positions={shape.points} pathOptions={{ color, weight: 2, fillOpacity: 0.25, interactive: false }}>
                  <Tooltip permanent direction="center" className="valuation-tooltip">
                    {kindLabel(shape.kind)} · {formatArea(Math.round(polygonAreaM2(shape.points)))}
                  </Tooltip>
                </Polygon>
                {/* Sin asas mientras se dibuja: taparían los clics del mapa junto a otra figura. */}
                {!drawing &&
                  shape.points.map((point, index) => (
                    <Marker
                      key={index}
                      position={point}
                      draggable
                      icon={VERTEX_ICONS[shape.kind]}
                      eventHandlers={{ drag: (e) => moveVertex(shape.id, index, e.target.getLatLng()) }}
                    />
                  ))}
              </Fragment>
            );
          })}

          {drawing && (
            <>
              {draft.length >= 2 && <Polyline positions={draft} pathOptions={{ color: draftColor, weight: 2, dashArray: "6 6", interactive: false }} />}
              {canClose && <Polygon positions={draft} pathOptions={{ color: draftColor, weight: 0, fillOpacity: 0.15, interactive: false }} />}
              {draft.map((point, index) => {
                const isCloser = index === 0 && canClose;
                return (
                  <CircleMarker
                    key={index}
                    center={point}
                    radius={isCloser ? 9 : 5}
                    pathOptions={{ color: "#ffffff", fillColor: draftColor, fillOpacity: 1, weight: 2, bubblingMouseEvents: false }}
                    eventHandlers={isCloser ? { click: finishDrawing } : undefined}
                  />
                );
              })}
            </>
          )}
        </MapContainer>
      </div>
      <p className="form-hint valuation-map__attribution">{t("valuation.map.attribution")}</p>
    </div>
  );
}
