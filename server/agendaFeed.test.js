import { describe, expect, it, vi } from "vitest";
import { serveAgendaFeed } from "./agendaFeed";

const token = "a".repeat(64);
const cita = { id: "c1", titulo: "Visita Casa Norte", fecha: "2026-11-20", hora: "10:00:00", duracion_min: 60, lugar: "Av. Hidalgo 100", actividades: null };

describe("serveAgendaFeed", () => {
  it("un token con mala forma es 404 y ni siquiera consulta la base", async () => {
    const rpc = vi.fn();
    for (const bad of [undefined, "", "abc", "g".repeat(64), `${token}0`]) {
      expect((await serveAgendaFeed({ token: bad, rpc })).status).toBe(404);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sirve el calendario con las citas, privado y sin caché compartida", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [cita], error: null });
    const out = await serveAgendaFeed({ token, rpc, now: new Date("2026-11-17T12:00:00Z") });
    expect(rpc).toHaveBeenCalledWith("get_agenda_feed", { p_token: token });
    expect(out.status).toBe(200);
    expect(out.headers["Content-Type"]).toContain("text/calendar");
    expect(out.headers["Cache-Control"]).toContain("private");
    expect(out.body).toContain("SUMMARY:Visita Casa Norte");
    expect(out.body).toContain("DTSTART:20261120T160000Z");
  });

  it("una agenda sin citas es un calendario válido vacío", async () => {
    const out = await serveAgendaFeed({ token, rpc: async () => ({ data: [], error: null }) });
    expect(out.status).toBe(200);
    expect(out.body).toContain("BEGIN:VCALENDAR");
    expect(out.body).not.toContain("VEVENT");
  });

  it("si la base falla o responde algo raro es 502 (no un calendario vacío que borraría el de la persona)", async () => {
    expect((await serveAgendaFeed({ token, rpc: async () => ({ data: null, error: { message: "x" } }) })).status).toBe(502);
    expect((await serveAgendaFeed({ token, rpc: async () => ({ data: { no: "arreglo" }, error: null }) })).status).toBe(502);
    expect((await serveAgendaFeed({ token, rpc: async () => { throw new Error("red"); } })).status).toBe(502);
  });
});
