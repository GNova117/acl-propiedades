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

describe("modo demo: ids propios (la cola sin señal) y claves duplicadas", () => {
  const visita = { property_id: "prop-3", advisor_id: "advisor-1", visited_at: "2026-11-01T10:00:00.000Z", prospect_name: "Ana", interest: "muy_interesado", reasons: [], comments: null };

  it("una cita con id propio lo conserva; repetir ese id se rechaza como la base real (23505) y no duplica", async () => {
    const cita = await db.addAgendaCita({ ...base, id: "cita-cola-1" });
    expect(cita.id).toBe("cita-cola-1");
    await expect(db.addAgendaCita({ ...base, id: "cita-cola-1" })).rejects.toMatchObject({ code: "23505" });
    expect((await db.getAgendaCitas()).filter((c) => c.id === "cita-cola-1")).toHaveLength(1);
  });

  it("sin id propio, la cita sigue recibiendo el suyo", async () => {
    const a = await db.addAgendaCita(base);
    const b = await db.addAgendaCita(base);
    expect(a.id).not.toBe(b.id);
  });

  it("una visita con id propio lo conserva; repetirlo se rechaza igual", async () => {
    const saved = await db.addVisit({ ...visita, id: "visita-cola-1" });
    expect(saved.id).toBe("visita-cola-1");
    await expect(db.addVisit({ ...visita, id: "visita-cola-1" })).rejects.toMatchObject({ code: "23505" });
    expect((await db.getVisits()).filter((v) => v.id === "visita-cola-1")).toHaveLength(1);
  });
});
