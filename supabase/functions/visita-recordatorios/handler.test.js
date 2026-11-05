import { describe, expect, it, vi } from "vitest";
import { runVisitReminders } from "./handler";

// 14:00 en México (UTC-6). Una visita de hoy a las 16:00 está a 2 h; una de mañana a las 14:00, a 24 h.
const NOW = new Date("2026-11-03T20:00:00Z");

const cita = (id, fecha, hora, extra = {}) => ({
  id,
  fecha,
  hora,
  duracion_min: 60,
  booking_token: id.padEnd(32, "0"),
  contact_name: "Ana Pérez",
  contact_email: `${id}@correo.com`,
  reschedule_count: 0,
  updated_at: "2026-11-01T10:00:00Z",
  email_reminder_24h_at: null,
  email_reminder_2h_at: null,
  property: { id: "p1", title: "Casa en Lerdo", code: "ACL-12", address: "Av. Hidalgo 1" },
  advisor: { name: "Carlos Delgado" },
  ...extra,
});

function setup(citas, overrides = {}) {
  const claimed = new Set();
  const deps = {
    now: NOW,
    siteUrl: "https://sitio.test",
    loadCandidates: vi.fn(async () => citas),
    claim: vi.fn(async (id, flag) => {
      const key = `${id}:${flag}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    }),
    release: vi.fn(async (id, flag) => claimed.delete(`${id}:${flag}`)),
    sendEmail: vi.fn(async () => ({ id: "re_1" })),
    ...overrides,
  };
  return deps;
}

describe("runVisitReminders", () => {
  it("pide las visitas de hoy y mañana (hora de México)", async () => {
    const deps = setup([]);
    await runVisitReminders(deps);
    expect(deps.loadCandidates).toHaveBeenCalledWith({ from: "2026-11-03", to: "2026-11-04" });
  });

  it("manda el de 24 h y el de 2 h a quien le toca, y nada a las demás", async () => {
    const deps = setup([
      cita("dos", "2026-11-03", "16:00"), // en 2 h
      cita("dia", "2026-11-04", "14:00"), // en 24 h
      cita("tarde", "2026-11-03", "20:00"), // en 6 h: todavía no
      cita("pasada", "2026-11-03", "09:00"), // ya pasó
    ]);
    const results = await runVisitReminders(deps);
    expect(results).toEqual({ "dos:recordatorio2h": "enviado", "dia:recordatorio24h": "enviado" });
    const subjects = deps.sendEmail.mock.calls.map(([m]) => `${m.to} | ${m.subject}`);
    expect(subjects).toEqual([expect.stringContaining("dos@correo.com | Tu visita es en 2 horas"), expect.stringContaining("dia@correo.com | Recordatorio: tu visita es mañana")]);
  });

  it("reclama el recordatorio ANTES de mandarlo, así dos corridas no lo duplican", async () => {
    const order = [];
    const deps = setup([cita("dos", "2026-11-03", "16:00")], {
      claim: vi.fn(async () => { order.push("claim"); return true; }),
      sendEmail: vi.fn(async () => { order.push("send"); return {}; }),
    });
    await runVisitReminders(deps);
    expect(order).toEqual(["claim", "send"]);
    expect(deps.claim).toHaveBeenCalledWith("dos", "email_reminder_2h_at");

    const shared = setup([cita("dos", "2026-11-03", "16:00")]);
    await runVisitReminders(shared);
    const second = await runVisitReminders(shared); // otra corrida con la misma base
    expect(shared.sendEmail).toHaveBeenCalledTimes(1);
    expect(second["dos:recordatorio2h"]).toContain("ya reclamada");
  });

  it("no repite el que ya se mandó (marca en la cita) ni manda uno por el otro", async () => {
    const deps = setup([cita("dos", "2026-11-03", "16:00", { email_reminder_2h_at: "2026-11-03T19:00:00Z" }), cita("dia", "2026-11-04", "14:00", { email_reminder_2h_at: "2026-11-03T19:00:00Z" })]);
    const results = await runVisitReminders(deps);
    expect(results).toEqual({ "dia:recordatorio24h": "enviado" }); // el de 2 h de "dos" ya salió; el de 24 h de "dia" es otro
    expect(deps.claim).toHaveBeenCalledTimes(1);
  });

  it("omite una visita agendada o movida hace menos de 3 horas (ya recibió el correo de confirmación)", async () => {
    const deps = setup([cita("nueva", "2026-11-03", "16:00", { updated_at: "2026-11-03T18:30:00Z" })]);
    const results = await runVisitReminders(deps);
    expect(results["nueva:recordatorio2h"]).toContain("hace poco");
    expect(deps.claim).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("si el envío falla libera el reclamo para reintentar en la siguiente corrida", async () => {
    const deps = setup([cita("dos", "2026-11-03", "16:00")], { sendEmail: vi.fn(async () => { throw new Error("Resend: 500"); }) });
    const results = await runVisitReminders(deps);
    expect(results["dos:recordatorio2h"]).toBe("error: Resend: 500");
    expect(deps.release).toHaveBeenCalledWith("dos", "email_reminder_2h_at");

    // En la siguiente corrida (Resend ya responde) sí sale.
    deps.sendEmail = vi.fn(async () => ({ id: "re_2" }));
    expect((await runVisitReminders(deps))["dos:recordatorio2h"]).toBe("enviado");
  });

  it("un fallo al liberar el reclamo no tumba el resto de los recordatorios", async () => {
    const deps = setup([cita("a", "2026-11-03", "16:00"), cita("b", "2026-11-03", "16:00")], {
      sendEmail: vi.fn(async ({ to }) => { if (to.startsWith("a")) throw new Error("falla"); return {}; }),
      release: vi.fn(async () => { throw new Error("base caída"); }),
    });
    const results = await runVisitReminders(deps);
    expect(results["a:recordatorio2h"]).toBe("error: falla");
    expect(results["b:recordatorio2h"]).toBe("enviado");
  });
});
