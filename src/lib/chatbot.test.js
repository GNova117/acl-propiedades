import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  buildWhatsappHandoffMessage,
  CHAT_TOOLS,
  normalizePropertyCode,
  normalizePropertySearchArgs,
  summarizeBookingResult,
  summarizeSlotsForChat,
  validateBookingArgs,
  validateHandoffArgs,
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

describe("buildWhatsappHandoffMessage", () => {
  it("devuelve undefined sin conversación", () => {
    expect(buildWhatsappHandoffMessage([])).toBeUndefined();
    expect(buildWhatsappHandoffMessage(null)).toBeUndefined();
  });

  it("incluye los turnos de la conversación en orden", () => {
    const msg = buildWhatsappHandoffMessage([
      { role: "user", content: "Busco casa en Torreón" },
      { role: "assistant", content: "Tengo 3 opciones en Torreón" },
    ]);
    expect(msg).toContain("Yo: Busco casa en Torreón");
    expect(msg).toContain("Asistente: Tengo 3 opciones en Torreón");
    expect(msg.indexOf("Busco casa")).toBeLessThan(msg.indexOf("Tengo 3 opciones"));
  });

  it("ignora mensajes de otros roles y contenido vacío", () => {
    const msg = buildWhatsappHandoffMessage([
      { role: "system", content: "prompt interno" },
      { role: "user", content: "  " },
      { role: "user", content: "Hola" },
    ]);
    expect(msg).not.toContain("prompt interno");
    expect(msg).toContain("Yo: Hola");
  });

  it("se queda con los turnos más recientes si la conversación no cabe en el tope", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `mensaje número ${i} con algo de texto para que pese` }));
    const msg = buildWhatsappHandoffMessage(messages);
    expect(msg.length).toBeLessThan(900);
    expect(msg).toContain("mensaje número 29");
    expect(msg).not.toContain("mensaje número 0 ");
  });
});

describe("agendar visitas desde el chat", () => {
  const NOW = new Date("2026-11-17T16:00:00Z");
  const args = { codigo: "acl-12", fecha: "2026-11-20", hora: "10:00", nombre: " Ana Pérez ", correo: "ANA@Correo.com", telefono: "871 123 4567" };

  it("las herramientas nuevas están declaradas con sus campos obligatorios", () => {
    const byName = Object.fromEntries(CHAT_TOOLS.map((t) => [t.name, t]));
    expect(byName.horarios_visita.input_schema.required).toEqual(["codigo"]);
    expect(byName.agendar_visita.input_schema.required).toEqual(["codigo", "fecha", "hora", "nombre", "correo", "telefono"]);
    expect(byName.pasar_a_asesor.input_schema.required).toEqual(["motivo"]);
  });

  it("el prompt pide ofrecer solo horarios reales y confirmar antes de agendar", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("horarios_visita");
    expect(prompt).toContain("agendar_visita");
    expect(prompt).toContain("pasar_a_asesor");
    expect(prompt).toContain("NUNCA inventes");
  });

  it("solo acepta códigos con forma de código", () => {
    expect(normalizePropertyCode(" acl-12 ")).toBe("ACL-12");
    for (const bad of ["", "a", "ACL 12", "x'; drop table", "<b>", null, "A".repeat(31)]) expect(normalizePropertyCode(bad)).toBeNull();
  });

  it("valida y normaliza los datos para book_visit", () => {
    expect(validateBookingArgs(args, NOW).value).toEqual({ code: "ACL-12", fecha: "2026-11-20", hora: "10:00", name: "Ana Pérez", email: "ana@correo.com", phone: "871 123 4567", note: null });
  });

  it("pide lo que falta, sin inventarlo", () => {
    expect(validateBookingArgs({ ...args, nombre: "" }, NOW).error).toContain("nombre completo");
    expect(validateBookingArgs({ ...args, correo: "x" }, NOW).error).toContain("correo válido");
    expect(validateBookingArgs({ ...args, telefono: "123" }, NOW).error).toContain("teléfono de 10 dígitos");
    expect(validateBookingArgs({ ...args, nota: "x".repeat(501) }, NOW).error).toContain("nota más corta");
    expect(validateBookingArgs({ ...args, codigo: "no es codigo" }, NOW).error).toContain("código");
  });

  it("rechaza fechas mal escritas, pasadas o a más de 60 días", () => {
    for (const fecha of ["20/11/2026", "mañana", "2026-11-16", "2027-06-01"]) expect(validateBookingArgs({ ...args, fecha }, NOW).error).toBeTruthy();
    expect(validateBookingArgs({ ...args, hora: "las diez" }, NOW).error).toBeTruthy();
    expect(validateBookingArgs({ ...args, fecha: "2026-11-17" }, NOW).value).toBeTruthy(); // hoy sí; la base decide si el horario sigue libre
  });

  it("resume los horarios por día con el día de la semana y recorta lo demás", () => {
    const slots = [
      ...["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((hora) => ({ fecha: "2026-11-18", hora: `${hora}:00` })),
      { fecha: "2026-11-19", hora: "10:00" },
      { fecha: "2026-11-20", hora: "10:00" },
      { fecha: "2026-11-21", hora: "10:00" },
      { fecha: "2026-11-22", hora: "10:00" },
    ];
    const text = summarizeSlotsForChat(slots, { property: "ACL-12" });
    expect(text).toContain("Horarios libres para ACL-12");
    expect(text).toContain("- mié 2026-11-18: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00 (+2 más)");
    expect(text).toContain("- jue 2026-11-19: 10:00");
    expect(text).not.toContain("2026-11-22"); // solo 4 días
  });

  it("sin horarios manda a un asesor", () => {
    expect(summarizeSlotsForChat([])).toContain("pasar_a_asesor");
    expect(summarizeSlotsForChat(null)).toContain("pasar_a_asesor");
  });

  it("traduce cada error de la base a una instrucción y nunca expone el enlace de la visita", () => {
    for (const error of ["invalid_name", "invalid_email", "invalid_phone", "invalid_note", "invalid_slot", "slot_unavailable", "property_unavailable", "rate_limited", "too_many_active", "upstream"]) {
      const out = summarizeBookingResult({ error });
      expect(out.booked).toBe(false);
      expect(out.text.length).toBeGreaterThan(10);
    }
    const ok = summarizeBookingResult({ ok: true, token: "abc".repeat(11), fecha: "2026-11-20", hora: "10:00:00" });
    expect(ok.booked).toBe(true);
    expect(ok.text).toContain("2026-11-20 a las 10:00");
    expect(ok.text).not.toContain("abcabc");
  });

  it("pasar_a_asesor: motivo acotado y el prospecto solo existe con un dato de contacto real", () => {
    expect(validateHandoffArgs({ motivo: "x".repeat(500) }).reason).toHaveLength(200);
    expect(validateHandoffArgs({}).reason).toBe("Pide hablar con un asesor");
    expect(validateHandoffArgs({ motivo: "precio" }).lead).toBeNull();
    const { lead } = validateHandoffArgs({ motivo: "precio", telefono: "871 555 0101" });
    expect(lead).toMatchObject({ name: "Contacto del chat", phone: "8715550101", interest: "PIDE UN ASESOR: precio" });
  });
});
