import { describe, expect, it } from "vitest";
import { advisorGreeting, advisorQrUrl, ADVISOR_PATH, SLUG_PATTERN, advisorProperties, advisorShareText, advisorSlug, advisorUrl, advisorWhatsappHref, assignSlugs, buildVCard, e164, isPublicAdvisor, vcardFileName } from "./advisorPage";

describe("advisorSlug / assignSlugs", () => {
  it("minúsculas, sin acentos y con guiones", () => {
    expect(advisorSlug("Ana María Pérez")).toBe("ana-maria-perez");
    expect(advisorSlug("  José  Ñandú  ")).toBe("jose-nandu");
    expect(advisorSlug("ACL Propiedades!")).toBe("acl-propiedades");
  });
  it("sin letras ni números queda «asesor» y siempre cumple el patrón", () => {
    expect(advisorSlug("¿¿??")).toBe("asesor");
    expect(advisorSlug("")).toBe("asesor");
    for (const name of ["Ana", "Luis Ángel", "", "$$$", "María-José"]) expect(advisorSlug(name)).toMatch(SLUG_PATTERN);
  });
  it("conserva el slug que ya tienen y no repite: -2, -3…", () => {
    const out = assignSlugs([{ id: 1, name: "Ana López" }, { id: 2, name: "Ana López" }, { id: 3, name: "Otro", slug: "ana-lopez-3" }, { id: 4, name: "Ana López" }]);
    expect(out.map((a) => a.slug)).toEqual(["ana-lopez", "ana-lopez-2", "ana-lopez-3", "ana-lopez-4"]);
  });
  it("un slug ya existente de otro asesor no se pisa", () => {
    const out = assignSlugs([{ id: 1, name: "Ana", slug: "ana" }, { id: 2, name: "Ana" }]);
    expect(out.map((a) => a.slug)).toEqual(["ana", "ana-2"]);
    expect(assignSlugs(undefined)).toEqual([]);
  });
});

describe("advisorUrl / isPublicAdvisor", () => {
  it("arma el enlace con el slug, o null sin él", () => {
    expect(advisorUrl({ slug: "ana" }, "https://acl.mx")).toBe(`https://acl.mx${ADVISOR_PATH}/ana`);
    expect(advisorUrl({ name: "Ana" }, "https://acl.mx")).toBeNull();
    expect(advisorUrl(null, "https://acl.mx")).toBeNull();
  });
  it("solo activos y visibles en el equipo", () => {
    expect(isPublicAdvisor({ active: true, show_in_team: true })).toBe(true);
    expect(isPublicAdvisor({})).toBe(true);
    expect(isPublicAdvisor({ active: false })).toBe(false);
    expect(isPublicAdvisor({ show_in_team: false })).toBe(false);
    expect(isPublicAdvisor(null)).toBe(false);
  });
});

describe("advisorProperties", () => {
  const p = (id, over = {}) => ({ id, status: "disponible", active: true, created_at: "2026-01-01", advisors: [{ id: "a1" }], ...over });
  it("solo las disponibles y activas de ese asesor, las más nuevas primero", () => {
    const list = [
      p("viejo", { created_at: "2026-01-01" }),
      p("nuevo", { created_at: "2026-06-01" }),
      p("vendida", { status: "vendida" }),
      p("inactiva", { active: false }),
      p("ajena", { advisors: [{ id: "a2" }] }),
      p("demo", { advisors: undefined, advisor_ids: ["a1", "a2"], created_at: "2026-03-01" }),
    ];
    expect(advisorProperties(list, "a1").map((x) => x.id)).toEqual(["nuevo", "demo", "viejo"]);
    expect(advisorProperties(undefined, "a1")).toEqual([]);
  });
});

describe("vCard", () => {
  const advisor = { name: "Ana María Pérez", phone: "871 324 3271", whatsapp: "5218713243272", email: "ana@acl.mx", bio: "Asesora, ventas; Torreón" };
  it("trae nombre, empresa, puesto, teléfonos con lada, correo y enlace, con CRLF", () => {
    const card = buildVCard(advisor, { url: "https://acl.mx/asesor/ana-maria-perez" });
    expect(card.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(card.endsWith("END:VCARD\r\n")).toBe(true);
    expect(card).toContain("N:María Pérez;Ana;;;");
    expect(card).toContain("FN:Ana María Pérez");
    expect(card).toContain("ORG:ACL Propiedades");
    expect(card).toContain(String.raw`TITLE:Asesora\, ventas\; Torreón`);
    expect(card).toContain("TEL;TYPE=CELL,VOICE:+528713243271");
    expect(card).toContain("TEL;TYPE=CELL:+5218713243272");
    expect(card).toContain("EMAIL;TYPE=INTERNET,WORK:ana@acl.mx");
    expect(card).toContain("URL:https://acl.mx/asesor/ana-maria-perez");
    expect(card.split("\n").every((line) => line === "" || line.endsWith("\r"))).toBe(true);
  });
  it("escapa diagonales, comas, puntos y comas y saltos de línea del texto libre", () => {
    const card = buildVCard({ name: "Ana", bio: "A\\B; C, D\nE" });
    expect(card).toContain(String.raw`TITLE:A\\B\; C\, D\nE`);
  });
  it("no repite el teléfono si el WhatsApp es el mismo ni inventa líneas sin dato", () => {
    const card = buildVCard({ name: "Luis", phone: "8713243271", whatsapp: "871-324-3271" });
    expect(card.match(/TEL/g)).toHaveLength(1);
    expect(card).not.toMatch(/EMAIL|TITLE|URL/);
    expect(card).toContain("N:;Luis;;;");
  });
  it("teléfonos: 10 dígitos llevan +52, con lada de país se respetan, sin dígitos no hay", () => {
    expect(e164("(871) 324-3271")).toBe("+528713243271");
    expect(e164("+52 1 871 324 3271")).toBe("+5218713243271");
    expect(e164("sin teléfono")).toBeNull();
  });
  it("nombre de archivo a partir del nombre", () => {
    expect(vcardFileName({ name: "Ana María Pérez" })).toBe("ana-maria-perez.vcf");
  });
});

describe("textos y WhatsApp", () => {
  it("mensaje para compartir con el enlace", () => {
    expect(advisorShareText({ name: " Ana " }, "https://acl.mx/asesor/ana")).toBe(
      "Soy Ana, asesor de ACL Propiedades. Aquí está mi tarjeta con mis propiedades y mis datos de contacto: https://acl.mx/asesor/ana"
    );
  });
  it("WhatsApp del asesor: usa su WhatsApp o su teléfono, con lada de México", () => {
    expect(advisorWhatsappHref({ whatsapp: "8713243271" })).toBe("https://wa.me/528713243271");
    expect(advisorWhatsappHref({ phone: "871 324 3271" }, "Hola Ana")).toBe("https://wa.me/528713243271?text=Hola%20Ana");
    expect(advisorWhatsappHref({})).toBeNull();
  });
});

describe("advisorGreeting", () => {
  it("saluda por el primer nombre y no deja «undefined»", () => {
    expect(advisorGreeting({ name: "Ana María Pérez" })).toBe("Hola Ana, vi tu tarjeta de ACL Propiedades y quiero más información.");
    expect(advisorGreeting(null)).toBe("Hola, vi tu tarjeta de ACL Propiedades y quiero más información.");
  });
});

describe("advisorQrUrl", () => {
  it("lleva a su página con la campaña de la tarjeta, o null sin slug", () => {
    expect(advisorQrUrl({ slug: "ana" }, "https://acl.mx")).toBe("https://acl.mx/asesor/ana?utm_source=qr&utm_medium=tarjeta&utm_campaign=ana");
    expect(advisorQrUrl({}, "https://acl.mx")).toBeNull();
  });
});
