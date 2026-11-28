import { describe, expect, it } from "vitest";
import { priceAlertNotice } from "./priceAlertNotice";

const alerts = [
  { id: 1, kind: "price", property_id: "p1", active: true },
  { id: 2, kind: "price", property_id: "p1", active: true },
  { id: 3, kind: "price", property_id: "p1", active: false },
  { id: 4, kind: "price", property_id: "p2", active: true },
  { id: 5, kind: "search", property_id: null, active: true },
];

describe("priceAlertNotice", () => {
  it("al bajar el precio cuenta las alertas activas de baja de esa propiedad", () => {
    expect(priceAlertNotice({ oldPrice: 2000000, newPrice: 1800000, alerts, propertyId: "p1" })).toEqual({ drop: true, count: 2 });
    expect(priceAlertNotice({ oldPrice: "2,000,000".replace(/,/g, ""), newPrice: "1900000", alerts, propertyId: "p2" })).toEqual({ drop: true, count: 1 });
  });

  it("si el precio sube, no cambia o no es válido, no hay aviso", () => {
    expect(priceAlertNotice({ oldPrice: 1000, newPrice: 1500, alerts, propertyId: "p1" })).toEqual({ drop: false, count: 0 });
    expect(priceAlertNotice({ oldPrice: 1000, newPrice: 1000, alerts, propertyId: "p1" })).toEqual({ drop: false, count: 0 });
    expect(priceAlertNotice({ oldPrice: "", newPrice: 500, alerts, propertyId: "p1" })).toEqual({ drop: false, count: 0 });
    expect(priceAlertNotice({ oldPrice: 1000, newPrice: "abc", alerts, propertyId: "p1" })).toEqual({ drop: false, count: 0 });
  });

  it("con una baja y sin alertas devuelve cero, y tolera listas vacías", () => {
    expect(priceAlertNotice({ oldPrice: 1000, newPrice: 900, alerts: [], propertyId: "p1" })).toEqual({ drop: true, count: 0 });
    expect(priceAlertNotice({ oldPrice: 1000, newPrice: 900, alerts: undefined, propertyId: "p1" })).toEqual({ drop: true, count: 0 });
  });
});
