import { describe, expect, it } from "vitest";
import { STAGE_TEMPLATE_KEYS, prospectMessageTemplates, sendLink, suggestPropertyMessage } from "./prospectMessages";

const keys = (templates) => templates.map((t) => t.key);
const text = (templates, key) => templates.find((t) => t.key === key).text;

describe("prospectMessageTemplates", () => {
  it("sin propiedad ofrece las cuatro plantillas generales, sin 'enviar la propiedad'", () => {
    const templates = prospectMessageTemplates({ name: "Ana López" });
    expect(keys(templates)).toEqual(["firstContact", "thanksVisit", "checkIn", "scheduleVisit"]);
  });

  it("con el enlace de la propiedad agrega 'enviar la propiedad' y lo incluye en el texto", () => {
    const templates = prospectMessageTemplates({ name: "Ana" }, { propertyTitle: "Casa en Lerdo", propertyUrl: "https://acl.mx/propiedades/42" });
    expect(keys(templates)).toContain("sendProperty");
    expect(text(templates, "sendProperty")).toContain("Casa en Lerdo");
    expect(text(templates, "sendProperty")).toContain("https://acl.mx/propiedades/42");
  });

  it("saluda solo con el primer nombre", () => {
    const templates = prospectMessageTemplates({ name: "  María Fernanda Gómez " });
    for (const t of templates) expect(t.text.startsWith("Hola María,")).toBe(true);
  });

  it("sin nombre saluda con un 'Hola' simple, sin dejar espacios ni 'undefined'", () => {
    for (const t of prospectMessageTemplates({ name: "" })) {
      expect(t.text.startsWith("Hola,")).toBe(true);
      expect(t.text).not.toMatch(/undefined|null/);
    }
  });

  it("menciona la propiedad de interés cuando la hay y lo omite cuando no", () => {
    const withProperty = prospectMessageTemplates({ name: "Ana" }, { propertyTitle: "Casa en Lerdo" });
    for (const key of ["firstContact", "thanksVisit", "checkIn", "scheduleVisit"]) expect(text(withProperty, key)).toContain("Casa en Lerdo");
    const without = prospectMessageTemplates({ name: "Ana" });
    for (const t of without) expect(t.text).not.toContain("Casa en Lerdo");
  });

  it("el primer contacto se presenta con el nombre del asesor si se conoce", () => {
    expect(text(prospectMessageTemplates({ name: "Ana" }, { advisorName: "Luis Pérez" }), "firstContact")).toContain("soy Luis Pérez de ACL Propiedades");
    expect(text(prospectMessageTemplates({ name: "Ana" }), "firstContact")).toContain("te escribo de ACL Propiedades");
  });
});

describe("plantillas por etapa del prospecto", () => {
  const options = { propertyTitle: "Casa en Lerdo", propertyUrl: "https://acl.mx/propiedades/42", advisorName: "Luis" };
  const recommended = (templates) => templates.filter((t) => t.recommended).map((t) => t.key);

  it("cada etapa sugiere primero sus plantillas, en el orden definido", () => {
    for (const [stage, expected] of Object.entries(STAGE_TEMPLATE_KEYS)) {
      const templates = prospectMessageTemplates({ name: "Ana", stage }, options);
      expect(recommended(templates), stage).toEqual(expected);
      expect(keys(templates).slice(0, expected.length), stage).toEqual(expected);
    }
  });

  it("en una etapa abierta, después de las sugeridas van las generales sin repetir", () => {
    const templates = prospectMessageTemplates({ name: "Ana", stage: "interesado" }, options);
    expect(new Set(keys(templates)).size).toBe(templates.length);
    expect(templates.filter((t) => t.recommended === false).map((t) => t.key)).toEqual(["firstContact", "checkIn", "scheduleVisit"]);
  });

  it("a un prospecto cerrado o perdido no le ofrece «primer contacto» ni las generales", () => {
    for (const stage of ["cerrado", "perdido"]) {
      const templates = prospectMessageTemplates({ name: "Ana", stage }, options);
      expect(keys(templates)).not.toContain("firstContact");
      expect(templates.every((t) => t.recommended)).toBe(true);
    }
  });

  it("sin enlace de la propiedad no sugiere enviarla, aunque la etapa la incluya", () => {
    const templates = prospectMessageTemplates({ name: "Ana", stage: "nuevo" }, { propertyTitle: "Casa en Lerdo" });
    expect(keys(templates)).not.toContain("sendProperty");
    expect(recommended(templates)).toEqual(["firstContact", "scheduleVisit"]);
  });

  it("todas las plantillas de etapa saludan por el primer nombre y no dejan huecos", () => {
    for (const stage of Object.keys(STAGE_TEMPLATE_KEYS)) {
      for (const withProperty of [options, {}]) {
        for (const t of prospectMessageTemplates({ name: "María Fernanda", stage }, withProperty)) {
          expect(t.text.startsWith("Hola María,"), `${stage}/${t.key}`).toBe(true);
          expect(t.text, `${stage}/${t.key}`).not.toMatch(/undefined|null|\s,|\s{2}/);
        }
      }
    }
  });

  it("las de negociación mencionan la propiedad cuando la hay", () => {
    const templates = prospectMessageTemplates({ name: "Ana", stage: "negociacion" }, options);
    expect(text(templates, "offerFollowUp")).toContain("Casa en Lerdo");
    expect(text(templates, "requestDocuments")).toContain("Casa en Lerdo");
  });
});

describe("suggestPropertyMessage", () => {
  const property = { title: "Casa en Residencial Senderos", zone: "Lerdo", price: 1650000 };

  it("saluda por el primer nombre e incluye título, zona, precio y enlace", () => {
    const text = suggestPropertyMessage({ name: "Ana López" }, property, "https://acl.mx/propiedades/7");
    expect(text.startsWith("Hola Ana,")).toBe(true);
    expect(text).toContain("Casa en Residencial Senderos en Lerdo, $1,650,000");
    expect(text).toContain("https://acl.mx/propiedades/7");
  });

  it("sin zona ni nombre no deja huecos ni 'undefined'", () => {
    const text = suggestPropertyMessage({ name: "" }, { title: "Terreno", price: 500000 }, "https://acl.mx/propiedades/9");
    expect(text.startsWith("Hola,")).toBe(true);
    expect(text).toContain("Terreno, $500,000");
    expect(text).not.toMatch(/undefined|null/);
  });
});

describe("sendLink", () => {
  it("prefiere WhatsApp (10 dígitos → lada 52) con el texto codificado", () => {
    expect(sendLink({ phone: "871 123 4567", email: "a@b.com" }, "Hola ¿qué tal?", "Asunto")).toBe(`https://wa.me/528711234567?text=${encodeURIComponent("Hola ¿qué tal?")}`);
  });
  it("sin teléfono cae al correo con asunto y cuerpo", () => {
    expect(sendLink({ phone: null, email: " ana@example.com " }, "Hola", "Una propiedad")).toBe("mailto:ana@example.com?subject=Una%20propiedad&body=Hola");
  });
  it("sin teléfono ni correo no hay a dónde enviar", () => {
    expect(sendLink({ phone: "", email: "" }, "Hola", "x")).toBeNull();
    expect(sendLink({}, "Hola", "x")).toBeNull();
  });
});
