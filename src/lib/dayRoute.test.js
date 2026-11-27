import { describe, expect, it } from "vitest";
import { MAX_STOPS, buildDayRoute, buildDaySheet, routeUrl } from "./dayRoute";

const item = (id, extra = {}, state = "later") => ({ cita: { id, titulo: `Cita ${id}`, hora: "10:00:00", ...extra }, state });
const props = [
  { id: "p1", title: "Casa Norte", lat: 25.5, lng: -103.4 },
  { id: "p2", title: "Sin mapa", lat: 0, lng: 0 },
];

describe("buildDayRoute", () => {
  it("usa las coordenadas de la propiedad y, si no, el lugar escrito", () => {
    const { stops } = buildDayRoute([item("a", { property_id: "p1", lugar: "Otra dirección" }), item("b", { property_id: "p2", lugar: "Av. Hidalgo 100" })], props);
    expect(stops.map((s) => s.query)).toEqual(["25.5,-103.4", "Av. Hidalgo 100"]);
    expect(stops[0].label).toBe("Casa Norte");
  });

  it("omite las que ya pasaron, las de todo el día y las sin lugar usable", () => {
    const { stops, unplaced } = buildDayRoute(
      [item("a", { lugar: "Calle 1" }, "past"), item("b", { lugar: "Calle 2" }, "allDay"), item("c", { lugar: "https://maps.app.goo.gl/x" }), item("d", { lugar: "" }), item("e", { lugar: "Calle 5" }, "now")],
      props
    );
    expect(stops.map((s) => s.query)).toEqual(["Calle 5"]);
    expect(unplaced.map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("junta visitas seguidas en el mismo lugar y limita las paradas", () => {
    const same = buildDayRoute([item("a", { lugar: "Calle 1" }), item("b", { lugar: "Calle 1" }), item("c", { lugar: "Calle 2" })], props);
    expect(same.stops).toHaveLength(2);
    expect(same.stops[0].citas).toHaveLength(2);
    const many = buildDayRoute(Array.from({ length: 13 }, (_, i) => item(`x${i}`, { lugar: `Calle ${i}` })), props);
    expect(many.stops).toHaveLength(MAX_STOPS);
    expect(many.truncated).toBe(3);
  });
});

describe("routeUrl", () => {
  it("sin paradas no hay enlace", () => {
    expect(routeUrl([])).toBeNull();
  });
  it("una parada es solo destino", () => {
    const url = routeUrl([{ query: "25.5,-103.4" }]);
    expect(url).toContain("destination=25.5%2C-103.4");
    expect(url).not.toContain("waypoints");
  });
  it("varias paradas: la última es destino y las demás van en orden como puntos intermedios", () => {
    const url = routeUrl([{ query: "Calle 1" }, { query: "Calle 2" }, { query: "Calle 3" }]);
    expect(url).toContain("destination=Calle%203");
    expect(url).toContain("waypoints=Calle%201%7CCalle%202");
  });
});

describe("buildDaySheet", () => {
  it("una fila por cita que falta, con dirección de la propiedad, contacto y notas", () => {
    const sheet = buildDaySheet(
      [
        item("a", { property_id: "p1", contact_name: "Ana", contact_phone: "871", actividades: " llevar llaves " }),
        item("b", { lugar: "Av. Hidalgo 100" }),
        item("c", { lugar: "https://maps.app.goo.gl/x" }),
        item("d", { lugar: "Calle 9" }, "past"),
      ],
      [{ id: "p1", code: "ACL-1", title: "Casa Norte", address: "Calle Norte 1" }]
    );
    expect(sheet.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(sheet[0]).toMatchObject({ hora: "10:00", propiedad: "ACL-1 · Casa Norte", direccion: "Calle Norte 1", contacto: "Ana · 871", notas: "llevar llaves" });
    expect(sheet[1].direccion).toBe("Av. Hidalgo 100");
    expect(sheet[2].direccion).toBe("");
  });
});
