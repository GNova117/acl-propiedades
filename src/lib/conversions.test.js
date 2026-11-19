import { describe, expect, it } from "vitest";
import { CONVERSIONS, buildConversion, isPhoneHref, isWhatsappContactHref, pageGroup } from "./conversions";

describe("buildConversion", () => {
  it("usa el nombre del catálogo y conserva los de visitas de siempre", () => {
    expect(buildConversion("lead_form", { form: "contacto" })).toEqual({ name: "generate_lead", params: { form: "contacto" } });
    expect(buildConversion("visit_booked").name).toBe("visit_booked");
    expect(buildConversion("visit_requested").name).toBe("visit_requested");
    expect(buildConversion("favorite_add").name).toBe("add_to_wishlist");
    expect(buildConversion("no_existe")).toBeNull();
  });

  it("NUNCA deja pasar datos personales ni claves no permitidas", () => {
    const { params } = buildConversion("lead_form", { form: "contacto", name: "Ana Pérez", email: "ana@correo.com", phone: "871 123 4567", message: "hola", property_id: "p1", extra: 1 });
    expect(params).toEqual({ form: "contacto", property_id: "p1" });
    expect(JSON.stringify(params)).not.toMatch(/Ana|correo|871/);
  });

  it("recorta textos largos y omite vacíos", () => {
    const { params } = buildConversion("share", { method: "x".repeat(200), location: "", property_id: null });
    expect(params).toEqual({ method: "x".repeat(80) });
  });

  it("cada conversión del catálogo tiene un nombre único", () => {
    const names = Object.values(CONVERSIONS);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("pageGroup", () => {
  it("dice dónde ocurrió sin mandar la dirección completa", () => {
    expect(pageGroup("/")).toBe("home");
    expect(pageGroup("/propiedades")).toBe("listing");
    expect(pageGroup("/propiedades/casa-en-senderos-ACL-1001")).toBe("property_detail");
    expect(pageGroup("/propiedades/zona/torreon/las-villas")).toBe("zone_landing");
    expect(pageGroup("/contacto")).toBe("contacto");
    expect(pageGroup("/desarrollos/torre-aurora")).toBe("development");
    expect(pageGroup(undefined)).toBe("home");
  });
});

describe("enlaces de contacto", () => {
  it("WhatsApp de contacto sí; «compartir» (sin número) no", () => {
    expect(isWhatsappContactHref("https://wa.me/528713243271")).toBe(true);
    expect(isWhatsappContactHref("https://wa.me/528713243271?text=Hola%20quiero")).toBe(true);
    expect(isWhatsappContactHref("https://api.whatsapp.com/send?phone=528713243271&text=x")).toBe(true);
    expect(isWhatsappContactHref("https://wa.me/?text=mira%20esta%20casa")).toBe(false);
    expect(isWhatsappContactHref("https://example.com/wa.me/528713243271")).toBe(false);
    expect(isWhatsappContactHref(null)).toBe(false);
  });
  it("teléfono", () => {
    expect(isPhoneHref("tel:+528713243271")).toBe(true);
    expect(isPhoneHref("mailto:a@b.mx")).toBe(false);
  });
});

describe("installConversionClicks", () => {
  // Un «documento» falso: guarda el oyente y lo dispara con enlaces simulados.
  async function setup() {
    const { vi } = await import("vitest");
    vi.resetModules();
    const sent = [];
    vi.doMock("./analytics.js", () => ({ trackEvent: (name, params) => sent.push({ name, params }) }));
    const { installConversionClicks } = await import("./conversions");
    let handler = null;
    const doc = { addEventListener: (_t, fn) => (handler = fn), removeEventListener: () => (handler = null) };
    const stop = installConversionClicks(doc, () => "/propiedades/casa-en-senderos-ACL-1001");
    const click = (href) => handler({ target: { closest: () => (href === null ? null : { getAttribute: () => href }) } });
    return { sent, click, stop, isActive: () => handler !== null };
  }

  it("cuenta el toque a WhatsApp de contacto y al teléfono, con la parte del sitio donde pasó", async () => {
    const { sent, click } = await setup();
    click("https://wa.me/528713243271?text=Hola");
    click("tel:+528713243271");
    expect(sent).toEqual([
      { name: "contact_whatsapp", params: { location: "property_detail" } },
      { name: "contact_phone", params: { location: "property_detail" } },
    ]);
  });

  it("no cuenta «compartir», correos, enlaces normales ni clics fuera de un enlace", async () => {
    const { sent, click } = await setup();
    click("https://wa.me/?text=mira");
    click("mailto:a@b.mx");
    click("/propiedades");
    click(null);
    expect(sent).toEqual([]);
  });

  it("al detenerlo deja de escuchar", async () => {
    const { stop, isActive } = await setup();
    expect(isActive()).toBe(true);
    stop();
    expect(isActive()).toBe(false);
  });
});
