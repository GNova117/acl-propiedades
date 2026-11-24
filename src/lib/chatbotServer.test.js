import { describe, expect, it, vi } from "vitest";
import { runChat } from "../../server/chatbot.js";

// Cliente falso de Anthropic: primero pide la herramienta capturar_lead y, con el resultado, contesta con texto.
function fakeClient() {
  const calls = [];
  const responses = [
    { stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "tool_use", id: "t1", name: "capturar_lead", input: { nombre: "Ana Pérez", telefono: "8711234567", interes: "casa en Torreón" } }] },
    { stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "listo" }] },
  ];
  return {
    calls,
    messages: {
      stream: (params) => {
        calls.push(JSON.parse(JSON.stringify(params.messages)));
        return { finalMessage: async () => responses[calls.length - 1] };
      },
    },
  };
}

describe("runChat — captura de prospectos", () => {
  it("avisa al modelo que NO quedó registrado cuando falla el guardado", async () => {
    const client = fakeClient();
    const onLead = vi.fn(async () => {
      throw new Error("insert falló");
    });
    const result = await runChat({ messages: [{ role: "user", content: "hola" }], searchProperties: async () => [], onLead }, { client });
    expect(result.leadCaptured).toBe(false);
    const toolResult = client.calls[1].at(-1).content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toMatch(/NO le digas que quedó registrado/);
  });

  it("marca el prospecto como capturado cuando se guarda", async () => {
    const client = fakeClient();
    const onLead = vi.fn(async () => {});
    const result = await runChat({ messages: [{ role: "user", content: "hola" }], searchProperties: async () => [], onLead }, { client });
    expect(result.leadCaptured).toBe(true);
    expect(onLead).toHaveBeenCalledTimes(1);
    expect(client.calls[1].at(-1).content[0].is_error).toBeUndefined();
  });
});
