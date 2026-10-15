// Chat del sitio público (uso interno, solo servidor) — ver api/chat.js y el
// widget en src/components/ChatWidget.jsx. Mismo criterio de separación que
// server/marketSearch.js: la llave ANTHROPIC_API_KEY nunca sale de aquí, y
// este archivo nunca toca Supabase directo — `searchProperties`/`onLead` son
// funciones que le inyecta quien llama.
import Anthropic from "@anthropic-ai/sdk";
import { CHAT_MODEL_DEFAULT, CHAT_TOOLS, buildSystemPrompt, normalizePropertySearchArgs, summarizePropertiesForChat, validateLeadArgs } from "../src/lib/chatbot.js";

export const DEFAULT_MODEL = CHAT_MODEL_DEFAULT;

// USD por millón de tokens, solo para registrar cuánto costó cada respuesta.
const PRICE_PER_MTOK = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

// Tope duro de idas y vueltas con herramientas dentro de UNA respuesta: una
// pregunta normal resuelve en 0-2 (una búsqueda, a veces un lead). Si se
// necesitaran más, algo salió mal — mejor cortar que dejar que seguir
// gastando en loop.
const MAX_TOOL_TURNS = 4;

export class ChatbotError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function toChatbotError(err) {
  if (err instanceof ChatbotError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ChatbotError("bad_key", "La llave de Anthropic no es válida o no tiene permiso.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ChatbotError("rate_limited", "Anthropic está limitando las consultas por ahora. Inténtalo en un minuto.");
  }
  if (err instanceof Anthropic.APIUserAbortError || err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ChatbotError("timeout", "La respuesta tardó demasiado.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new ChatbotError("bad_request", err.message || "Anthropic rechazó la consulta.");
  }
  return new ChatbotError("upstream", err?.message || "No se pudo consultar a Anthropic.");
}

export function estimateCostUsd(model, usage) {
  const price = PRICE_PER_MTOK[model];
  if (!price) return null;
  const usd = (usage.input / 1e6) * price.input + (usage.output / 1e6) * price.output;
  return Math.round(usd * 1e6) / 1e6;
}

async function runTool(toolUse, { searchProperties, onLead }) {
  if (toolUse.name === "buscar_propiedades") {
    const args = normalizePropertySearchArgs(toolUse.input);
    const properties = await searchProperties(args);
    return { type: "tool_result", tool_use_id: toolUse.id, content: summarizePropertiesForChat(properties) };
  }
  if (toolUse.name === "capturar_lead") {
    const lead = validateLeadArgs(toolUse.input);
    if (!lead) {
      return { type: "tool_result", tool_use_id: toolUse.id, content: "Falta un dato de contacto válido (teléfono o correo).", is_error: true };
    }
    await onLead(lead);
    return { type: "tool_result", tool_use_id: toolUse.id, content: "Listo, ya quedó registrado. Un asesor le dará seguimiento pronto.", leadCaptured: true };
  }
  return { type: "tool_result", tool_use_id: toolUse.id, content: "Esa herramienta no existe.", is_error: true };
}

// Punto de entrada. `client` se puede inyectar (pruebas); en producción se
// crea con la llave de entorno. `messages` ya viene validado por quien llama
// (ver validateIncomingMessages en src/lib/chatbot.js).
export async function runChat({ messages, searchProperties, onLead }, { client, model = DEFAULT_MODEL, budgetMs = 25_000 } = {}) {
  const anthropic = client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  const deadline = Date.now() + budgetMs;
  const conversation = messages.map((m) => ({ role: m.role, content: m.content }));
  const usage = { input: 0, output: 0 };
  let leadCaptured = false;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const remaining = deadline - Date.now();
    if (remaining < 2_000) throw new ChatbotError("timeout", "La respuesta tardó demasiado.");

    let message;
    try {
      message = await anthropic.messages
        .stream(
          {
            model,
            // Corto a propósito: es un endpoint público sin login, y el
            // sistema le pide respuestas de 2-4 oraciones. Un tope bajo
            // acota el gasto si algo sale raro, sin cortar una respuesta normal.
            max_tokens: 1024,
            output_config: { effort: "low" },
            system: buildSystemPrompt(),
            tools: CHAT_TOOLS,
            messages: conversation,
          },
          { signal: AbortSignal.timeout(remaining), maxRetries: 0 }
        )
        .finalMessage();
    } catch (err) {
      throw toChatbotError(err);
    }

    usage.input += message.usage?.input_tokens || 0;
    usage.output += message.usage?.output_tokens || 0;

    if (message.stop_reason === "refusal") {
      throw new ChatbotError("refused", "Claude declinó responder.");
    }

    const toolUses = message.content.filter((b) => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return {
        reply: text || "Disculpa, no entendí bien tu mensaje — ¿me lo puedes decir de otra forma?",
        leadCaptured,
        usage: { ...usage, model, costUsd: estimateCostUsd(model, usage) },
      };
    }

    conversation.push({ role: "assistant", content: message.content });
    // Un solo mensaje de usuario con TODOS los tool_result de este turno —
    // partirlos en varios mensajes le enseña al modelo a dejar de pedir
    // herramientas en paralelo.
    const toolResults = await Promise.all(toolUses.map((toolUse) => runTool(toolUse, { searchProperties, onLead })));
    if (toolResults.some((r) => r.leadCaptured)) leadCaptured = true;
    conversation.push({ role: "user", content: toolResults.map(({ leadCaptured: _lc, ...r }) => r) });
  }
  throw new ChatbotError("too_many_turns", "La conversación necesitó demasiados pasos para responder.");
}
