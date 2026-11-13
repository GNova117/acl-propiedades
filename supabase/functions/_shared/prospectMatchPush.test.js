import { describe, expect, it } from "vitest";
import { matchingProspects } from "../../../src/lib/prospectMatch";
import { freshEvents } from "../../../src/lib/matchAlerts";
import { buildPush, eventKey, isQuietHour, planMatchPushes, prospectsFor, recentEvents } from "./prospectMatchPush";

const NOW = new Date("2026-11-13T18:00:00Z").getTime(); // 12:00 en México
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();

const house = (over = {}) => ({ id: "h1", title: "Casa Lerdo", type: "casa", operation_type: "compra", zone: "Lerdo", price: 1500000, bedrooms: 3, status: "disponible", active: true, created_at: hoursAgo(200), ...over });
const prospect = (over = {}) => ({ id: "p1", name: "Ana López", stage: "interesado", advisor_id: "a1", property_id: null, search_criteria: { type: "casa", zone: "Lerdo", max_price: 1800000 }, ...over });

describe("misma coincidencia que el panel", () => {
  const properties = [
    house(),
    house({ id: "h2", zone: "Torreón - Las Villas", price: 900000 }),
    house({ id: "h3", zone: "Gómez Palacio", bedrooms: 2 }),
    house({ id: "h4", type: "departamento", operation_type: "renta", price: 8000, amenities: ["alberca", "gimnasio"] }),
    house({ id: "h5", status: "vendida" }),
  ];
  const prospects = [
    prospect(),
    prospect({ id: "p2", search_criteria: { zone: "Torreón" } }),
    prospect({ id: "p3", search_criteria: { zone: "Torreón - Las Villas", max_price: 1000000 } }),
    prospect({ id: "p4", search_criteria: { type: "departamento", operation_type: "renta", amenities: ["alberca"], max_price: 10000 } }),
    prospect({ id: "p5", search_criteria: { min_bedrooms: 3 } }),
    prospect({ id: "p6", search_criteria: {} }),
    prospect({ id: "p7", stage: "cerrado" }),
    prospect({ id: "p8", property_id: "h1" }),
  ];

  it("para cada propiedad, los mismos prospectos que matchingProspects()", () => {
    for (const property of properties) {
      expect(prospectsFor(property, prospects).map((p) => p.id).sort(), property.id).toEqual(matchingProspects(property, prospects).map((p) => p.id).sort());
    }
  });

  it("las mismas novedades que freshEvents() mientras la ventana en horas y en días coincide (propiedades de hace 1 y 3 días)", () => {
    const list = [house({ id: "n1", created_at: hoursAgo(10) }), house({ id: "n2", created_at: hoursAgo(300) }), house({ id: "d1", price: 900000, previous_price: 1000000, price_changed_at: hoursAgo(5) })];
    expect(recentEvents(list, NOW).map((e) => [e.property.id, e.kind, e.percent])).toEqual(freshEvents(list, NOW).map((e) => [e.property.id, e.kind, e.percent]));
  });
});

describe("recentEvents", () => {
  it("cuenta las últimas 48 horas; antes, no", () => {
    const list = [house({ id: "ayer", created_at: hoursAgo(20) }), house({ id: "viejo", created_at: hoursAgo(60) })];
    expect(recentEvents(list, NOW).map((e) => e.property.id)).toEqual(["ayer"]);
  });
  it("una rebaja reciente cuenta aunque la propiedad sea vieja y trae el porcentaje", () => {
    const [e] = recentEvents([house({ price: 900000, previous_price: 1000000, price_changed_at: hoursAgo(3) })], NOW);
    expect(e).toMatchObject({ kind: "priceDrop", percent: 10 });
  });
});

describe("planMatchPushes", () => {
  const nueva = house({ id: "nueva", created_at: hoursAgo(2) });

  it("un push por asesor con sus prospectos, y deja registrada la novedad", () => {
    const { claims, pushes } = planMatchPushes({
      properties: [nueva],
      prospects: [prospect(), prospect({ id: "p2", name: "Luis Pérez", advisor_id: "a2" }), prospect({ id: "p3", name: "Eva Ruiz", advisor_id: "a1" })],
      now: NOW,
    });
    expect(claims).toEqual([{ property_id: "nueva", kind: "new", event_at: nueva.created_at }]);
    expect(pushes).toHaveLength(2);
    const a1 = pushes.find((p) => p.advisorId === "a1");
    expect(a1).toMatchObject({ office: false, url: "/admin/mi-dia", title: "Propiedad nueva que le encaja a 2 prospectos" });
    expect(a1.body).toContain("Casa Lerdo (Lerdo) — $1,500,000");
    expect(a1.body).toContain("Ana, Eva");
    expect(pushes.find((p) => p.advisorId === "a2").title).toBe("Propiedad nueva que le encaja a Luis");
  });

  it("los prospectos sin asesor van a la oficina, aparte", () => {
    const { pushes } = planMatchPushes({ properties: [nueva], prospects: [prospect({ advisor_id: null })], now: NOW });
    expect(pushes).toEqual([expect.objectContaining({ advisorId: null, office: true, url: "/admin/prospectos", title: "Propiedad nueva que le encaja a Ana (sin asesor)" })]);
  });

  it("lo ya avisado no se repite; sin prospectos que encajen no hay push ni registro", () => {
    const sent = new Set([eventKey("nueva", "new", nueva.created_at)]);
    expect(planMatchPushes({ properties: [nueva], prospects: [prospect()], sent, now: NOW })).toEqual({ claims: [], pushes: [] });
    expect(planMatchPushes({ properties: [nueva], prospects: [prospect({ search_criteria: { type: "terreno" } })], now: NOW })).toEqual({ claims: [], pushes: [] });
  });

  it("la llave se compara por instante, aunque la base devuelva la fecha en otro formato", () => {
    const sent = new Set([eventKey("nueva", "new", new Date(nueva.created_at).toISOString().replace("Z", "+00:00"))]);
    expect(planMatchPushes({ properties: [nueva], prospects: [prospect()], sent, now: NOW }).pushes).toEqual([]);
  });

  it("varias novedades de un mismo asesor se juntan en un solo push", () => {
    const otra = house({ id: "otra", title: "Casa Gómez", created_at: hoursAgo(1) });
    const { claims, pushes } = planMatchPushes({ properties: [nueva, otra], prospects: [prospect({ search_criteria: { type: "casa" } })], now: NOW });
    expect(claims).toHaveLength(2);
    expect(pushes).toHaveLength(1);
    expect(pushes[0].title).toBe("2 propiedades le encajan a tus prospectos");
  });

  it("una rebaja se anuncia como tal", () => {
    const { pushes } = planMatchPushes({ properties: [house({ price: 900000, previous_price: 1000000, price_changed_at: hoursAgo(1) })], prospects: [prospect()], now: NOW });
    expect(pushes[0].title).toBe("Bajó de precio y le encaja a Ana");
    expect(pushes[0].body).toContain("Bajó 10 %");
  });
});

describe("buildPush y horario", () => {
  it("el cuerpo no pasa de 150 caracteres y nombra a pocos, con «y N más»", () => {
    const prospects = ["Ana", "Beto", "Carla", "Diego", "Elena"].map((name, i) => prospect({ id: `p${i}`, name }));
    const push = buildPush([{ property: house({ title: "Casa con un nombre larguísimo ".repeat(6) }), kind: "new", prospects }]);
    expect(push.body.length).toBeLessThanOrEqual(150);
    const short = buildPush([{ property: house(), kind: "new", prospects }]);
    expect(short.body).toContain("Ana, Beto, Carla y 2 más");
  });
  it("solo avisa de 8 am a 8 pm hora de México", () => {
    expect(isQuietHour(new Date("2026-11-13T13:00:00Z"))).toBe(true); // 7:00
    expect(isQuietHour(new Date("2026-11-13T14:00:00Z"))).toBe(false); // 8:00
    expect(isQuietHour(new Date("2026-11-14T01:59:00Z"))).toBe(false); // 19:59
    expect(isQuietHour(new Date("2026-11-14T02:00:00Z"))).toBe(true); // 20:00
  });
});
