import { beforeEach, describe, expect, it } from "vitest";

// Modo demo (espejo de property_offers y property_holds de schema.sql): mismas validaciones, un solo apartado
// vigente por propiedad y el estatus de la propiedad que sigue al apartado.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

const { localBackend: db } = await import("./localBackend");
const { PROPERTIES } = await import("./seedData");

const available = PROPERTIES.find((p) => p.status === "disponible" && p.active);
const nextWeek = new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA");

beforeEach(() => store.clear());

describe("modo demo: ofertas", () => {
  it("guarda ofertas y contraofertas, las más nuevas primero, y cambia su estado", async () => {
    const first = await db.addPropertyOffer(available.id, { party: "cliente", buyerName: "Luis", amount: 900000 });
    await new Promise((r) => setTimeout(r, 5));
    await db.addPropertyOffer(available.id, { party: "propietario", buyerName: "Luis", amount: 950000, note: "Piso firme" });
    const list = await db.getPropertyOffers(available.id);
    expect(list.map((o) => o.party)).toEqual(["propietario", "cliente"]);
    expect(list[0].status).toBe("abierta");
    expect((await db.setPropertyOfferStatus(first.id, "aceptada")).status).toBe("aceptada");
    expect(await db.getPropertyOffers("otra")).toEqual([]);
  });

  it("valida igual que la base y borra", async () => {
    await expect(db.addPropertyOffer(available.id, { party: "cliente", buyerName: "Luis", amount: 0 })).rejects.toThrow("offer:amount");
    await expect(db.addPropertyOffer(available.id, { party: "x", buyerName: "Luis", amount: 5 })).rejects.toThrow("offer:party");
    const o = await db.addPropertyOffer(available.id, { party: "cliente", buyerName: "Luis", amount: 5 });
    await expect(db.setPropertyOfferStatus(o.id, "rara")).rejects.toThrow("offer:status");
    await db.deletePropertyOffer(o.id);
    expect(await db.getPropertyOffers(available.id)).toEqual([]);
  });
});

describe("modo demo: apartados", () => {
  it("apartar deja la propiedad «apartada» y solo permite un apartado vigente", async () => {
    await db.addPropertyHold(available.id, { buyerName: "Ana", amount: 20000, dueDate: nextWeek });
    expect((await db.getPropertyById(available.id)).status).toBe("apartada");
    await expect(db.addPropertyHold(available.id, { buyerName: "Otra", amount: 1, dueDate: nextWeek })).rejects.toThrow("hold:exists");
    expect(await db.getPropertyHolds()).toHaveLength(1); // sin propiedad: todos los vigentes
  });

  it("cancelar regresa la propiedad a «disponible»; concretar no cambia el estatus", async () => {
    const hold = await db.addPropertyHold(available.id, { buyerName: "Ana", dueDate: nextWeek });
    await db.setPropertyHoldStatus(hold.id, "cancelado");
    expect((await db.getPropertyById(available.id)).status).toBe("disponible");
    expect(await db.getPropertyHolds()).toEqual([]);
    expect((await db.getPropertyHolds(available.id))[0].status).toBe("cancelado");

    const again = await db.addPropertyHold(available.id, { buyerName: "Beto", dueDate: nextWeek });
    await db.setPropertyHoldStatus(again.id, "concretado");
    expect((await db.getPropertyById(available.id)).status).toBe("apartada");
  });

  it("valida fecha, nombre y estado", async () => {
    await expect(db.addPropertyHold(available.id, { buyerName: "Ana", dueDate: "2020-01-01" })).rejects.toThrow("hold:pastDate");
    await expect(db.addPropertyHold(available.id, { buyerName: " ", dueDate: nextWeek })).rejects.toThrow("hold:name");
    const hold = await db.addPropertyHold(available.id, { buyerName: "Ana", dueDate: nextWeek });
    await expect(db.setPropertyHoldStatus(hold.id, "vigente")).rejects.toThrow("hold:status");
  });
});

describe("modo demo: calendario suscribible", () => {
  it("no existe sin servidor", async () => {
    await expect(db.createAgendaFeedToken()).rejects.toThrow("agendaFeed:demo");
    expect(await db.getAgendaFeedToken()).toBeNull();
  });
});
