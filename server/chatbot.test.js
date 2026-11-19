import { describe, expect, it, vi } from "vitest";
import { addDays, mexicoParts } from "../src/lib/visitSlots.js";
import { runChat } from "./chatbot.js";

// Un día cercano (la validación rechaza fechas pasadas o a más de 60 días).
const FECHA = addDays(mexicoParts().date, 3);

// El loop de herramientas con un cliente de Anthropic simulado: cada respuesta del «modelo» está escrita de antemano.
const toolUse = (id, name, input) => ({ type: "tool_use", id, name, input });
const reply = (content, stop = "tool_use") => ({ content, stop_reason: stop, usage: { input_tokens: 10, output_tokens: 5 } });

function fakeClient(script) {
  const calls = [];
  return {
    calls,
    messages: {
      stream: (params) => {
        calls.push(JSON.parse(JSON.stringify(params.messages)));
        const next = script.shift();
        return { finalMessage: async () => next };
      },
    },
  };
}

const SLOT = { fecha: `${FECHA}`, hora: "10:00", advisors: [] };
const base = { messages: [{ role: "user", content: "quiero visitar ACL-12" }], searchProperties: async () => [], onLead: vi.fn(async () => {}) };
const toolResultsOf = (conversation) => conversation.at(-1).content;

describe("chat: agendar una visita", () => {
  it("consulta horarios, agenda y avisa al widget; el enlace privado nunca llega al modelo", async () => {
    const client = fakeClient([
      reply([toolUse("t1", "horarios_visita", { codigo: "acl-12" })]),
      reply([toolUse("t2", "agendar_visita", { codigo: "ACL-12", fecha: `${FECHA}`, hora: "10:00", nombre: "Ana Pérez", correo: "ANA@correo.com", telefono: "871 123 4567" })]),
      reply([{ type: "text", text: "¡Listo, quedó agendada!" }], "end_turn"),
    ]);
    const listVisitSlots = vi.fn(async () => [SLOT]);
    const bookVisit = vi.fn(async () => ({ ok: true, token: "secreto".repeat(5), fecha: `${FECHA}`, hora: "10:00:00" }));
    const result = await runChat({ ...base, listVisitSlots, bookVisit }, { client });

    expect(listVisitSlots).toHaveBeenCalledWith("ACL-12");
    expect(bookVisit).toHaveBeenCalledWith({ code: "ACL-12", fecha: `${FECHA}`, hora: "10:00", name: "Ana Pérez", email: "ana@correo.com", phone: "871 123 4567", note: null });
    expect(result).toMatchObject({ reply: "¡Listo, quedó agendada!", visitBooked: true, handoff: false });
    const slotsText = toolResultsOf(client.calls[1])[0].content;
    expect(slotsText).toContain(`${FECHA}: 10:00`);
    expect(JSON.stringify(client.calls)).not.toContain("secreto");
    expect(toolResultsOf(client.calls[2])[0].content).toContain(`${FECHA} a las 10:00`);
  });

  it("sin horarios en línea el modelo recibe la instrucción de pasar a un asesor", async () => {
    const client = fakeClient([reply([toolUse("t1", "horarios_visita", { codigo: "ACL-12" })]), reply([{ type: "text", text: "ok" }], "end_turn")]);
    await runChat({ ...base, listVisitSlots: async () => [], bookVisit: vi.fn() }, { client });
    expect(toolResultsOf(client.calls[1])[0].content).toContain("pasar_a_asesor");
  });

  it("un código inexistente es un error de la herramienta, no una excepción", async () => {
    const client = fakeClient([reply([toolUse("t1", "horarios_visita", { codigo: "ACL-99" })]), reply([{ type: "text", text: "ok" }], "end_turn")]);
    await runChat({ ...base, listVisitSlots: async () => null, bookVisit: vi.fn() }, { client });
    const [result] = toolResultsOf(client.calls[1]);
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("No encontré");
  });

  it("no agenda con datos incompletos y le dice al modelo qué pedir", async () => {
    const bookVisit = vi.fn();
    const client = fakeClient([
      reply([toolUse("t1", "agendar_visita", { codigo: "ACL-12", fecha: `${FECHA}`, hora: "10:00", nombre: "Ana", correo: "no-es-correo", telefono: "123" })]),
      reply([{ type: "text", text: "¿Me das tu correo?" }], "end_turn"),
    ]);
    const result = await runChat({ ...base, listVisitSlots: vi.fn(), bookVisit }, { client });
    expect(bookVisit).not.toHaveBeenCalled();
    expect(result.visitBooked).toBe(false);
    const [r] = toolResultsOf(client.calls[1]);
    expect(r.is_error).toBe(true);
    expect(r.content).toContain("correo válido");
    expect(r.content).toContain("teléfono de 10 dígitos");
  });

  it("un horario que ya no está libre no cuenta como agendada", async () => {
    const client = fakeClient([
      reply([toolUse("t1", "agendar_visita", { codigo: "ACL-12", fecha: `${FECHA}`, hora: "10:00", nombre: "Ana Pérez", correo: "ana@correo.com", telefono: "8711234567" })]),
      reply([{ type: "text", text: "Ese horario se ocupó." }], "end_turn"),
    ]);
    const result = await runChat({ ...base, listVisitSlots: vi.fn(), bookVisit: async () => ({ error: "slot_unavailable" }) }, { client });
    expect(result.visitBooked).toBe(false);
    expect(toolResultsOf(client.calls[1])[0].content).toContain("ya no está libre");
  });

  it("sin las funciones de agenda inyectadas responde que no está disponible", async () => {
    const client = fakeClient([reply([toolUse("t1", "horarios_visita", { codigo: "ACL-12" })]), reply([{ type: "text", text: "ok" }], "end_turn")]);
    await runChat(base, { client });
    expect(toolResultsOf(client.calls[1])[0].content).toContain("no está disponible");
  });
});

describe("chat: pasar a un asesor", () => {
  it("con datos de contacto guarda el prospecto marcado y activa el botón de WhatsApp", async () => {
    const onLead = vi.fn(async () => {});
    const client = fakeClient([
      reply([toolUse("t1", "pasar_a_asesor", { motivo: "Quiere negociar el precio", nombre: "Luis", telefono: "8715550101" })]),
      reply([{ type: "text", text: "Un asesor te escribe." }], "end_turn"),
    ]);
    const result = await runChat({ ...base, onLead }, { client });
    expect(result).toMatchObject({ handoff: true, leadCaptured: true });
    expect(onLead).toHaveBeenCalledWith(expect.objectContaining({ name: "Luis", phone: "8715550101", interest: "PIDE UN ASESOR: Quiere negociar el precio" }));
  });

  it("sin contacto solo activa el botón (no guarda un prospecto vacío)", async () => {
    const onLead = vi.fn(async () => {});
    const client = fakeClient([reply([toolUse("t1", "pasar_a_asesor", { motivo: "Prefiere hablar con una persona" })]), reply([{ type: "text", text: "Claro." }], "end_turn")]);
    const result = await runChat({ ...base, onLead }, { client });
    expect(result).toMatchObject({ handoff: true, leadCaptured: false });
    expect(onLead).not.toHaveBeenCalled();
  });

  it("las banderas internas no se mandan al modelo", async () => {
    const client = fakeClient([reply([toolUse("t1", "pasar_a_asesor", { motivo: "x" })]), reply([{ type: "text", text: "ok" }], "end_turn")]);
    await runChat(base, { client });
    const [r] = toolResultsOf(client.calls[1]);
    expect(Object.keys(r).sort()).toEqual(["content", "tool_use_id", "type"]);
  });
});
