import { describe, expect, it } from "vitest";
import { closedAt, postsaleDue, postsaleMessage } from "./postsale";

describe("closedAt", () => {
  it("usa la primera vez que el historial registra el paso a 'cerrado'", () => {
    const prospect = { id: 1, updated_at: "2026-05-01" };
    const history = [
      { prospecto_id: 1, stage: "interesado", at: "2026-01-01" },
      { prospecto_id: 1, stage: "cerrado", at: "2026-02-01" },
      { prospecto_id: 1, stage: "cerrado", at: "2026-02-15" }, // reabierto y vuelto a cerrar: cuenta la primera
    ];
    expect(closedAt(prospect, history)).toBe("2026-02-01");
  });

  it("sin historial, cae a la fecha de edición o de creación (prospectos antiguos)", () => {
    expect(closedAt({ id: 1, updated_at: "2026-05-01", created_at: "2026-01-01" }, [])).toBe("2026-05-01");
    expect(closedAt({ id: 1, created_at: "2026-01-01" }, [])).toBe("2026-01-01");
  });
});

describe("postsaleDue", () => {
  const dayms = 86400000;

  it("un prospecto que no está cerrado nunca tiene seguimiento posventa pendiente", () => {
    expect(postsaleDue({ stage: "interesado" }, [])).toBeNull();
  });

  it("antes de los 30 días no hay nada pendiente", () => {
    const closedRecently = new Date(Date.now() - 10 * dayms).toISOString();
    expect(postsaleDue({ stage: "cerrado", updated_at: closedRecently }, [])).toBeNull();
  });

  it("a partir de los 30 días, el paso de 30 días queda pendiente si no se ha marcado hecho", () => {
    const closed30 = new Date(Date.now() - 31 * dayms).toISOString();
    const due = postsaleDue({ stage: "cerrado", updated_at: closed30 }, []);
    expect(due).toMatchObject({ key: "30" });
  });

  it("el de 180 días no aparece hasta que el de 30 ya se marcó hecho", () => {
    const closed200 = new Date(Date.now() - 200 * dayms).toISOString();
    const notDone30 = postsaleDue({ stage: "cerrado", updated_at: closed200 }, []);
    expect(notDone30.key).toBe("30"); // sigue pendiente el de 30, aunque ya pasaron 180 días

    const done30 = postsaleDue({ stage: "cerrado", updated_at: closed200, postsale_30_done_at: "2026-01-01" }, []);
    expect(done30.key).toBe("180");
  });

  it("con ambos pasos ya hechos, no queda nada pendiente", () => {
    const closed200 = new Date(Date.now() - 200 * dayms).toISOString();
    const done = postsaleDue(
      { stage: "cerrado", updated_at: closed200, postsale_30_done_at: "2026-01-01", postsale_180_done_at: "2026-02-01" },
      []
    );
    expect(done).toBeNull();
  });
});

describe("postsaleMessage", () => {
  it("usa solo el primer nombre y menciona la propiedad si se da", () => {
    const msg = postsaleMessage({ name: "Ana García López" }, "30", "Casa Centro");
    expect(msg).toContain("Hola Ana,");
    expect(msg).toContain("(Casa Centro)");
  });

  it("el mensaje de 180 días es distinto del de 30 días", () => {
    const msg30 = postsaleMessage({ name: "Ana" }, "30", null);
    const msg180 = postsaleMessage({ name: "Ana" }, "180", null);
    expect(msg30).not.toBe(msg180);
    expect(msg180).toContain("seis meses");
    expect(msg30).toContain("un mes");
  });
});
