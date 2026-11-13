import { describe, expect, it } from "vitest";
import { citaPlace, directionsUrl, distanceKm, estimateLeg, MAX_ROUTE_STOPS, planDayRoute } from "./dayRoute";

// Dos puntos de Torreón a unos 4 km en línea recta (≈5 km por calle).
const CASA = { id: "p1", title: "Casa Centro", address: "Calle Morelos 100, Torreón", lat: 25.5428, lng: -103.4068 };
const DEPA = { id: "p2", title: "Depa Residencial", address: "Blvd. Revolución 500, Torreón", lat: 25.5428, lng: -103.3668 };
const SIN_MAPA = { id: "p3", title: "Terreno Lerdo", address: "Carretera Lerdo km 3", lat: null, lng: null };

const item = (over = {}, state = "later") => ({
  state,
  cita: { id: "c", titulo: "Visita", fecha: "2026-11-13", hora: "10:00", duracion_min: 60, lugar: null, property_id: null, ...over },
});

describe("citaPlace", () => {
  it("sin lugar escrito usa la propiedad: coordenadas para el enlace y el mapa, dirección para leer", () => {
    expect(citaPlace({ lugar: "" }, CASA)).toEqual({ label: CASA.address, query: "25.5428,-103.4068", pin: { lat: 25.5428, lng: -103.4068 } });
  });

  it("si el lugar es la propiedad (por dirección o título, sin importar acentos ni mayúsculas) también tiene ubicación exacta", () => {
    expect(citaPlace({ lugar: "calle MORELOS 100, torreón" }, CASA).pin).toEqual({ lat: 25.5428, lng: -103.4068 });
    expect(citaPlace({ lugar: "casa centro" }, CASA).pin).not.toBeNull();
  });

  it("un lugar escrito distinto de la propiedad se manda como texto y no lleva pin (no se le inventa la ubicación de la propiedad)", () => {
    expect(citaPlace({ lugar: "Café Plaza Galerías" }, CASA)).toEqual({ label: "Café Plaza Galerías", query: "Café Plaza Galerías", pin: null });
  });

  it("propiedad sin ubicación: usa su dirección como texto", () => {
    expect(citaPlace({ lugar: "" }, SIN_MAPA)).toEqual({ label: SIN_MAPA.address, query: SIN_MAPA.address, pin: null });
  });

  it("sin lugar ni propiedad no hay parada", () => {
    expect(citaPlace({ lugar: "" }, null)).toBeNull();
    expect(citaPlace({ lugar: "   " }, { id: "x" })).toBeNull();
  });

  it("un enlace de mapa no sirve como parada (no se sabe si es la propiedad): esa cita queda fuera de la ruta", () => {
    expect(citaPlace({ lugar: "https://maps.app.goo.gl/abc" }, null)).toBeNull();
    expect(citaPlace({ lugar: "https://maps.app.goo.gl/abc" }, SIN_MAPA)).toBeNull();
    expect(citaPlace({ lugar: "https://maps.app.goo.gl/abc" }, CASA)).toBeNull();
  });
});

describe("distancias", () => {
  it("haversine: 0.04° de longitud en Torreón son unos 4 km", () => {
    const km = distanceKm({ lat: CASA.lat, lng: CASA.lng }, { lat: DEPA.lat, lng: DEPA.lng });
    expect(km).toBeGreaterThan(3.8);
    expect(km).toBeLessThan(4.2);
  });

  it("el tramo se estima por calle (más largo que la línea recta) y a velocidad de ciudad", () => {
    const leg = estimateLeg({ pin: { lat: CASA.lat, lng: CASA.lng } }, { pin: { lat: DEPA.lat, lng: DEPA.lng } });
    expect(leg.km).toBeGreaterThan(4.8);
    expect(leg.km).toBeLessThan(5.6);
    expect(leg.minutes).toBeGreaterThanOrEqual(9);
    expect(leg.minutes).toBeLessThanOrEqual(12);
  });

  it("sin ubicación en alguna de las dos no hay tramo", () => {
    expect(estimateLeg({ pin: null }, { pin: { lat: 1, lng: 1 } })).toBeNull();
    expect(estimateLeg(null, null)).toBeNull();
  });
});

describe("directionsUrl", () => {
  const stop = (query) => ({ query });

  it("una parada es solo destino; varias llevan las intermedias como waypoints y la última de destino", () => {
    const one = new URL(directionsUrl([stop("A")]));
    expect(one.searchParams.get("destination")).toBe("A");
    expect(one.searchParams.has("waypoints")).toBe(false);
    const many = new URL(directionsUrl([stop("A"), stop("B"), stop("C")]));
    expect(many.origin + many.pathname).toBe("https://www.google.com/maps/dir/");
    expect(many.searchParams.get("destination")).toBe("C");
    expect(many.searchParams.get("waypoints")).toBe("A|B");
    expect(many.searchParams.get("travelmode")).toBe("driving");
    expect(many.searchParams.has("origin")).toBe(false); // sale de donde esté el asesor
  });

  it("respeta el tope de paradas de Google Maps", () => {
    const stops = Array.from({ length: 14 }, (_, i) => stop(`P${i + 1}`));
    const url = new URL(directionsUrl(stops));
    expect(url.searchParams.get("destination")).toBe(`P${MAX_ROUTE_STOPS}`);
    expect(url.searchParams.get("waypoints").split("|")).toHaveLength(MAX_ROUTE_STOPS - 1);
  });

  it("sin paradas no hay enlace", () => {
    expect(directionsUrl([])).toBeNull();
  });
});

describe("planDayRoute", () => {
  it("numera las paradas en orden, salta las ya terminadas y separa las que no tienen lugar", () => {
    const plan = planDayRoute(
      [
        item({ id: "a", hora: "08:00", property_id: "p1" }, "past"),
        item({ id: "b", hora: "10:00", property_id: "p1" }, "next"),
        item({ id: "c", hora: "12:00", lugar: "" }, "later"),
        item({ id: "d", hora: "14:00", property_id: "p2" }, "later"),
      ],
      [CASA, DEPA],
    );
    expect(plan.stops.map((s) => [s.number, s.cita.id])).toEqual([[1, "b"], [2, "d"]]);
    expect(plan.unplaced.map((i) => i.cita.id)).toEqual(["c"]);
    expect(plan.stops[0].leg).toBeNull();
    expect(plan.stops[1].leg.km).toBeGreaterThan(0);
    expect(plan.totalKm).toBe(plan.stops[1].leg.km);
    expect(plan.url).toContain("google.com/maps/dir");
    expect(plan.truncated).toBe(false);
  });

  it("avisa cuando no alcanza el tiempo entre dos citas (late) o va justo (tight)", () => {
    // Trayecto ≈ 10 min. Cita 1: 10:00–11:00.
    const base = (hora) => planDayRoute([item({ id: "a", hora: "10:00", property_id: "p1" }), item({ id: "b", hora, property_id: "p2" })], [CASA, DEPA]).stops[1].leg;
    expect(base("11:05")).toMatchObject({ level: "late", gap: 5 }); // 5 min de hueco, 10 de camino
    expect(base("11:15")).toMatchObject({ level: "tight", gap: 15 }); // alcanza, pero con menos de 10 min de margen
    expect(base("12:00")).toMatchObject({ level: null, gap: 60 });
  });

  it("usa la duración de la cita para saber cuándo termina", () => {
    const leg = planDayRoute([item({ id: "a", hora: "10:00", duracion_min: 30, property_id: "p1" }), item({ id: "b", hora: "10:45", property_id: "p2" })], [CASA, DEPA]).stops[1].leg;
    expect(leg).toMatchObject({ gap: 15, level: "tight" });
  });

  it("sin hora en alguna cita o sin ubicación en alguna parada no se opina del tiempo", () => {
    const sinHora = planDayRoute([item({ id: "a", hora: null, property_id: "p1" }, "allDay"), item({ id: "b", hora: "10:00", property_id: "p2" })], [CASA, DEPA]).stops[1].leg;
    expect(sinHora).toMatchObject({ gap: null, level: null });
    const sinMapa = planDayRoute([item({ id: "a", hora: "10:00", property_id: "p1" }), item({ id: "b", hora: "10:30", property_id: "p3" })], [CASA, SIN_MAPA]);
    expect(sinMapa.stops[1].leg).toBeNull();
    expect(sinMapa.totalKm).toBe(0);
  });

  it("más paradas de las que caben en el enlace se marcan como truncadas", () => {
    const items = Array.from({ length: 12 }, (_, i) => item({ id: `c${i}`, hora: `${String(8 + i).padStart(2, "0")}:00`, lugar: `Lugar ${i + 1}` }));
    const plan = planDayRoute(items, []);
    expect(plan.stops).toHaveLength(12);
    expect(plan.truncated).toBe(true);
    expect(new URL(plan.url).searchParams.get("destination")).toBe(`Lugar ${MAX_ROUTE_STOPS}`);
  });

  it("un día sin citas con lugar da una ruta vacía, sin enlace", () => {
    const plan = planDayRoute([item({ id: "a", lugar: "" })], []);
    expect(plan.stops).toEqual([]);
    expect(plan.url).toBeNull();
    expect(plan.unplaced).toHaveLength(1);
  });
});
