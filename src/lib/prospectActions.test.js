import { describe, expect, it, vi } from "vitest";
import { clientFromProspect, contactAgoText, convertProspectToClient, findExistingClient, quickTemplates, telHref, whatsappLink } from "./prospectActions";

// `t` de mentira: devuelve la clave y los parámetros, suficiente para ver qué texto se pide.
const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe("telHref y whatsappLink", () => {
  it("anteponen la lada de México a un número de 10 dígitos", () => {
    expect(telHref("871 123 4567")).toBe("tel:+528711234567");
    expect(whatsappLink("(871) 123-4567")).toBe("https://wa.me/528711234567");
  });

  it("respetan un número que ya trae lada", () => {
    expect(telHref("+52 1 871 123 4567")).toBe("tel:+5218711234567");
    expect(whatsappLink("52 871 123 4567")).toBe("https://wa.me/528711234567");
  });

  it("devuelven null sin dígitos", () => {
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(whatsappLink("sin número")).toBeNull();
  });
});

describe("quickTemplates", () => {
  const prospect = { name: "María López", stage: "nuevo", property_id: "prop-1" };

  it("traduce la etiqueta de cada plantilla y arma el enlace de la propiedad de interés", () => {
    const templates = quickTemplates(prospect, { propertyTitle: "Casa Campestre", advisorName: "Carlos", origin: "https://acl.test", t });
    expect(templates.length).toBeGreaterThan(0);
    for (const tpl of templates) expect(tpl.label).toBe(`prospects.templates.${tpl.key}`);
    expect(templates.some((tpl) => tpl.text.includes("https://acl.test/propiedades/prop-1"))).toBe(true);
    expect(templates.some((tpl) => tpl.text.includes("Hola María"))).toBe(true);
  });

  it("sin propiedad de interés no inventa un enlace", () => {
    const templates = quickTemplates({ ...prospect, property_id: null }, { origin: "https://acl.test", t });
    expect(templates.some((tpl) => tpl.text.includes("/propiedades/"))).toBe(false);
  });
});

describe("contactAgoText", () => {
  it("distingue sin contacto, hoy y hace N días", () => {
    expect(contactAgoText({ last_contact_at: null }, t)).toBe("prospects.noContact");
    expect(contactAgoText({ last_contact_at: new Date().toISOString() }, t)).toBe("prospects.contactToday");
    const old = new Date(Date.now() - 3 * 864e5).toISOString();
    expect(contactAgoText({ last_contact_at: old }, t)).toBe('prospects.contactAgo:{"count":3}');
  });
});

describe("findExistingClient", () => {
  const clients = [
    { id: "c1", name: "Ana", phone: "+52 871 111 2222", email: "ana@correo.com" },
    { id: "c2", name: "Beto", phone: "8713334444", email: "" },
  ];

  it("encuentra al cliente por los últimos 10 dígitos del teléfono, con o sin lada", () => {
    expect(findExistingClient(clients, { phone: "871-111-2222" }).id).toBe("c1");
    expect(findExistingClient(clients, { phone: "52 871 333 4444" }).id).toBe("c2");
  });

  it("encuentra al cliente por correo sin importar mayúsculas", () => {
    expect(findExistingClient(clients, { phone: "", email: " ANA@correo.com " }).id).toBe("c1");
  });

  it("no confunde un teléfono corto ni un correo vacío con una coincidencia", () => {
    expect(findExistingClient(clients, { phone: "1112222", email: "" })).toBeNull();
    expect(findExistingClient(clients, { phone: "", email: "" })).toBeNull();
  });
});

describe("clientFromProspect", () => {
  it("crea un comprador con lo que busca y las notas del prospecto", () => {
    expect(clientFromProspect({ name: "Luis", phone: "8715550000", email: "", looking_for: "Terreno", notes: "Llamar en la tarde" })).toEqual({
      name: "Luis",
      type: "comprador",
      email: null,
      phone: "8715550000",
      notes: "Busca: Terreno\nLlamar en la tarde",
      active: true,
    });
  });

  it("sin notas ni búsqueda deja las notas en null", () => {
    expect(clientFromProspect({ name: "Luis" }).notes).toBeNull();
  });
});

describe("convertProspectToClient", () => {
  const fakeDb = (clients = []) => ({
    getClients: vi.fn(async () => clients),
    addClient: vi.fn(async (c) => ({ id: "nuevo", ...c })),
    updateProspect: vi.fn(async () => ({})),
  });

  it("crea el cliente y deja ligado al prospecto", async () => {
    const db = fakeDb();
    const id = await convertProspectToClient(db, { id: "p1", name: "Luis", phone: "8715550000" }, () => true);
    expect(id).toBe("nuevo");
    expect(db.addClient).toHaveBeenCalledOnce();
    expect(db.updateProspect).toHaveBeenCalledWith("p1", { client_id: "nuevo" });
  });

  it("si ya existe, vincula a ese cliente en lugar de duplicarlo", async () => {
    const db = fakeDb([{ id: "c9", name: "Luis", phone: "871 555 0000" }]);
    const confirm = vi.fn(() => true);
    const id = await convertProspectToClient(db, { id: "p1", name: "Luis", phone: "8715550000" }, confirm);
    expect(id).toBe("c9");
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ id: "c9" }));
    expect(db.addClient).not.toHaveBeenCalled();
    expect(db.updateProspect).toHaveBeenCalledWith("p1", { client_id: "c9" });
  });

  it("si se rechaza vincular al existente, no toca nada y devuelve null", async () => {
    const db = fakeDb([{ id: "c9", name: "Luis", phone: "871 555 0000" }]);
    expect(await convertProspectToClient(db, { id: "p1", name: "Luis", phone: "8715550000" }, () => false)).toBeNull();
    expect(db.addClient).not.toHaveBeenCalled();
    expect(db.updateProspect).not.toHaveBeenCalled();
  });
});
