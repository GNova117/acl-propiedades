import { beforeEach, describe, expect, it } from "vitest";

// Citas de la Agenda creadas a mano: pueden ir ligadas a una propiedad y a un prospecto
// (el botón «Agendar» del prospecto), y editarlas no debe perder esas ligas.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { localBackend: db } = await import("./localBackend");

const base = { advisor_id: "advisor-1", client_id: "", titulo: "Visita: Casa Campestre", fecha: "2030-01-15", hora: "10:00", actividades: "" };

beforeEach(() => store.clear());

describe("modo demo: citas con propiedad y prospecto", () => {
  it("guarda la propiedad y el prospecto al crear la cita", async () => {
    const cita = await db.addAgendaCita({ ...base, property_id: "prop-3", prospecto_id: "p1" });
    expect(cita).toMatchObject({ property_id: "prop-3", prospecto_id: "p1", source: "admin", status: "confirmada" });
    expect((await db.getAgendaCitaById(cita.id)).property_id).toBe("prop-3");
  });

  it("sin ellas, quedan en null (como antes)", async () => {
    const cita = await db.addAgendaCita(base);
    expect(cita.property_id).toBeNull();
    expect(cita.prospecto_id).toBeNull();
  });

  it("al editar sin mandar propiedad no la toca; con una nueva la cambia; vacía la quita; el prospecto se conserva", async () => {
    const cita = await db.addAgendaCita({ ...base, property_id: "prop-3", prospecto_id: "p1" });

    let editada = await db.updateAgendaCita(cita.id, { ...base, titulo: "Otro título" });
    expect(editada).toMatchObject({ titulo: "Otro título", property_id: "prop-3", prospecto_id: "p1" });

    editada = await db.updateAgendaCita(cita.id, { ...base, property_id: "prop-4" });
    expect(editada.property_id).toBe("prop-4");

    editada = await db.updateAgendaCita(cita.id, { ...base, property_id: "" });
    expect(editada.property_id).toBeNull();
    expect(editada.prospecto_id).toBe("p1");
  });
});
