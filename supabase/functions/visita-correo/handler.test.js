import { describe, expect, it, vi } from "vitest";
import { handleVisitEmail } from "./handler";

const NOW = new Date("2026-11-03T20:00:00Z");
const cita = {
  id: "c1",
  status: "confirmada",
  fecha: "2026-11-05",
  hora: "16:00:00",
  duracion_min: 60,
  booking_token: "b".repeat(32),
  contact_name: "Ana Pérez",
  contact_email: "ana@correo.com",
  reschedule_count: 0,
  cancelled_by: null,
  property: { id: "p1", title: "Casa en Lerdo", code: "ACL-12", address: "Av. Hidalgo 1" },
  advisor: { name: "Carlos Delgado" },
};

function deps(overrides = {}) {
  return {
    loadCita: vi.fn(async () => cita),
    sendEmail: vi.fn(async () => ({ id: "re_123" })),
    siteUrl: "https://sitio.test",
    now: NOW,
    ...overrides,
  };
}

describe("handleVisitEmail", () => {
  it("manda la confirmación al correo de quien reservó, con el .ics", async () => {
    const d = deps();
    const result = await handleVisitEmail({ cita_id: "c1", kind: "confirmacion" }, d);
    expect(result).toEqual({ status: 200, body: { ok: true, kind: "confirmacion", id: "re_123" } });
    expect(d.loadCita).toHaveBeenCalledWith("c1");
    const sent = d.sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("ana@correo.com");
    expect(sent.subject).toContain("Tu visita está agendada");
    expect(sent.html).toContain("https://sitio.test/visita/" + "b".repeat(32));
    expect(sent.attachments).toHaveLength(1);
  });

  it("la reprogramación y la cancelación usan su propio correo", async () => {
    const d1 = deps();
    await handleVisitEmail({ cita_id: "c1", kind: "reprogramada" }, d1);
    expect(d1.sendEmail.mock.calls[0][0].subject).toContain("Cambiamos tu visita");

    const d2 = deps({ loadCita: vi.fn(async () => ({ ...cita, status: "cancelada", cancelled_by: "asesor" })) });
    await handleVisitEmail({ cita_id: "c1", kind: "cancelacion" }, d2);
    expect(d2.sendEmail.mock.calls[0][0].subject).toContain("Visita cancelada");
    expect(d2.sendEmail.mock.calls[0][0].attachments).toEqual([]);
  });

  it("rechaza peticiones sin cita_id o con un tipo desconocido, sin tocar la base ni mandar nada", async () => {
    const d = deps();
    expect((await handleVisitEmail({ kind: "confirmacion" }, d)).status).toBe(400);
    expect((await handleVisitEmail({ cita_id: "c1", kind: "spam" }, d)).status).toBe(400);
    expect((await handleVisitEmail(undefined, d)).status).toBe(400);
    expect(d.loadCita).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("una cita que no existe da 404 y no manda nada", async () => {
    const d = deps({ loadCita: vi.fn(async () => null) });
    expect((await handleVisitEmail({ cita_id: "x", kind: "confirmacion" }, d)).status).toBe(404);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("sin correo válido no manda nada (y no es un error)", async () => {
    for (const contact_email of [null, "", "no-es-correo"]) {
      const d = deps({ loadCita: vi.fn(async () => ({ ...cita, contact_email })) });
      const result = await handleVisitEmail({ cita_id: "c1", kind: "confirmacion" }, d);
      expect(result).toEqual({ status: 200, body: { skipped: "sin correo válido" } });
      expect(d.sendEmail).not.toHaveBeenCalled();
    }
  });

  it("si la cita ya cambió de estado, no manda un aviso que ya no corresponde", async () => {
    // Se pidió "confirmacion" pero entre tanto se canceló: no se le manda "tu visita está agendada".
    const d = deps({ loadCita: vi.fn(async () => ({ ...cita, status: "cancelada" })) });
    const result = await handleVisitEmail({ cita_id: "c1", kind: "confirmacion" }, d);
    expect(result.body.skipped).toContain("cancelada");
    expect(d.sendEmail).not.toHaveBeenCalled();

    const d2 = deps();
    expect((await handleVisitEmail({ cita_id: "c1", kind: "cancelacion" }, d2)).body.skipped).toContain("confirmada");
    expect(d2.sendEmail).not.toHaveBeenCalled();
  });

  it("si el envío falla, el error sube (el servidor responde 500)", async () => {
    const d = deps({ sendEmail: vi.fn(async () => { throw new Error("Resend: 401"); }) });
    await expect(handleVisitEmail({ cita_id: "c1", kind: "confirmacion" }, d)).rejects.toThrow("Resend: 401");
  });
});
