import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  normalizePropertySearchArgs,
  summarizePropertiesForChat,
  validateIncomingMessages,
  validateLeadArgs,
  whatsappHref,
} from "./chatbot";

describe("buildSystemPrompt", () => {
  it("incluye las zonas y los datos de contacto de la oficina", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Torreón");
    expect(prompt).toContain("Gómez Palacio");
    expect(prompt).toContain("871 324 3271");
  });

  it("instruye a usar las herramientas en vez de inventar datos", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("buscar_propiedades");
    expect(prompt).toContain("capturar_lead");
    expect(prompt.toLowerCase()).toContain("nunca inventes");
  });
});

describe("normalizePropertySearchArgs", () => {
  it("descarta un tipo u operación que no está en la lista permitida", () => {
    const result = normalizePropertySearchArgs({ tipo: "mansion", operacion: "robar" });
    expect(result.type).toBeUndefined();
    expect(result.operation).toBeUndefined();
  });

  it("acepta valores válidos y limpia la zona", () => {
    const result = normalizePropertySearchArgs({ tipo: "casa", operacion: "compra", zona: "  Las Fuentes  " });
    expect(result).toMatchObject({ type: "casa", operation: "compra", zone: "Las Fuentes" });
  });

  it("ignora precios fuera de rango o no numéricos", () => {
    expect(normalizePropertySearchArgs({ precio_min: -5 }).minPrice).toBeUndefined();
    expect(normalizePropertySearchArgs({ precio_min: "mucho" }).minPrice).toBeUndefined();
    expect(normalizePropertySearchArgs({ precio_min: 1500000 }).minPrice).toBe(1500000);
  });
});

describe("summarizePropertiesForChat", () => {
  it("avisa cuando no hay resultados", () => {
    expect(summarizePropertiesForChat([])).toMatch(/no se encontraron/i);
  });

  it("formatea cada propiedad en una línea con precio en MXN", () => {
    const text = summarizePropertiesForChat([{ code: "ACL-1", title: "Casa en Las Fuentes", price: 1350000, zone: "Gómez Palacio", bedrooms: 3 }]);
    expect(text).toContain("ACL-1");
    expect(text).toContain("Casa en Las Fuentes");
    expect(text).toContain("$1,350,000");
    expect(text).toContain("3 recámaras");
  });

  it("recorta a 5 propiedades y avisa cuántas quedaron fuera", () => {
    const properties = Array.from({ length: 8 }, (_, i) => ({ code: `ACL-${i}`, title: `Casa ${i}`, price: 1000000, zone: "Torreón" }));
    const text = summarizePropertiesForChat(properties);
    expect(text.split("\n").filter((l) => l.startsWith("-"))).toHaveLength(5);
    expect(text).toMatch(/hay 3 más/);
  });
});

describe("validateLeadArgs", () => {
  it("rechaza sin nombre", () => {
    expect(validateLeadArgs({ telefono: "8711234567" })).toBeNull();
  });

  it("rechaza sin teléfono ni correo", () => {
    expect(validateLeadArgs({ nombre: "Ana" })).toBeNull();
  });

  it("acepta con teléfono válido (10 dígitos, tolera formato)", () => {
    const lead = validateLeadArgs({ nombre: "Ana López", telefono: "(871) 123-4567" });
    expect(lead).toMatchObject({ name: "Ana López", phone: "8711234567", email: null });
  });

  it("acepta con correo válido cuando no hay teléfono", () => {
    const lead = validateLeadArgs({ nombre: "Ana", correo: "Ana@Ejemplo.com" });
    expect(lead).toMatchObject({ name: "Ana", phone: null, email: "ana@ejemplo.com" });
  });

  it("descarta un correo con formato inválido", () => {
    const lead = validateLeadArgs({ nombre: "Ana", correo: "no-es-correo" });
    expect(lead).toBeNull();
  });
});

describe("validateIncomingMessages", () => {
  it("rechaza un arreglo vacío o algo que no es arreglo", () => {
    expect(validateIncomingMessages([])).toBeNull();
    expect(validateIncomingMessages(null)).toBeNull();
    expect(validateIncomingMessages("hola")).toBeNull();
  });

  it("rechaza un rol que no sea user/assistant", () => {
    expect(validateIncomingMessages([{ role: "system", content: "hola" }])).toBeNull();
  });

  it("rechaza si el último mensaje no es del usuario", () => {
    const messages = [
      { role: "user", content: "hola" },
      { role: "assistant", content: "hola, ¿en qué te ayudo?" },
    ];
    expect(validateIncomingMessages(messages)).toBeNull();
  });

  it("rechaza más mensajes de los permitidos", () => {
    const messages = Array.from({ length: 41 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: "hola" }));
    expect(validateIncomingMessages(messages)).toBeNull();
  });

  it("acepta y recorta espacios en blanco", () => {
    const result = validateIncomingMessages([{ role: "user", content: "  hola  " }]);
    expect(result).toEqual([{ role: "user", content: "hola" }]);
  });
});

describe("whatsappHref", () => {
  it("arma el enlace de wa.me con el mensaje codificado", () => {
    expect(whatsappHref("Hola!")).toBe("https://wa.me/528713243271?text=Hola!");
  });

  it("usa un mensaje por defecto cuando no se le da ninguno", () => {
    expect(whatsappHref()).toContain("Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n");
  });
});
