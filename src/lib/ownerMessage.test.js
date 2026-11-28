import { describe, expect, it } from "vitest";
import { OWNER_STATUSES, buildOwnerMessage, whatsappDraftUrl } from "./ownerMessage";

// `t` de prueba: devuelve la clave y los datos para ver qué se pidió.
const t = (key, data) => `${key}|${data.title}|${data.code}|${data.url}`;

describe("buildOwnerMessage", () => {
  const property = { title: "Casa en Los Fresnos", code: "ACL-1004" };

  it("usa la plantilla del estatus con el título, el código y la dirección", () => {
    expect(buildOwnerMessage(t, property, "vendida", "https://x.mx/p/1")).toBe("ownerMessage.templates.vendida|Casa en Los Fresnos|ACL-1004|https://x.mx/p/1");
    for (const status of OWNER_STATUSES) expect(buildOwnerMessage(t, property, status, "")).toContain(`templates.${status}`);
  });

  it("con un estatus desconocido usa la plantilla de «disponible» y tolera datos faltantes", () => {
    expect(buildOwnerMessage(t, property, "otro", "")).toContain("templates.disponible");
    expect(buildOwnerMessage(t, undefined, "apartada", undefined)).toBe("ownerMessage.templates.apartada|||");
  });
});

describe("whatsappDraftUrl", () => {
  it("abre WhatsApp sin número y con el texto codificado", () => {
    expect(whatsappDraftUrl("Hola, ¿qué tal?")).toBe("https://wa.me/?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F");
  });
});
