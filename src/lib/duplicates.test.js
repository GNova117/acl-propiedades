import { describe, expect, it } from "vitest";
import { emailKey, findDuplicates, phoneKey } from "./duplicates";

const advisors = [
  { id: "a1", name: "Luis" },
  { id: "a2", name: "Rosa" },
];
const prospects = [
  { id: "p1", name: "Ana López", phone: "+52 871 123 4567", email: "ana@mail.com", stage: "contactado", advisor_id: "a1" },
  { id: "p2", name: "Beto", phone: "8719990000", email: "", stage: "nuevo", advisor_id: "a2" },
];
const clients = [{ id: "c1", name: "Carla", phone: "(871) 555-0000", email: "carla@mail.com" }];
const ctx = { prospects, clients, advisors };

describe("phoneKey / emailKey", () => {
  it("toma los últimos 10 dígitos sin importar el formato", () => {
    expect(phoneKey("+52 1 871 123 4567")).toBe("8711234567");
    expect(phoneKey("(871) 123-4567")).toBe("8711234567");
  });
  it("un número corto o vacío no sirve para comparar", () => {
    expect(phoneKey("123456")).toBeNull();
    expect(phoneKey("")).toBeNull();
    expect(phoneKey(undefined)).toBeNull();
  });
  it("el correo se compara sin mayúsculas ni espacios", () => {
    expect(emailKey("  Ana@Mail.COM ")).toBe("ana@mail.com");
    expect(emailKey("")).toBeNull();
  });
});

describe("findDuplicates", () => {
  it("encuentra al prospecto con el mismo teléfono aunque esté escrito distinto", () => {
    const [dup] = findDuplicates({ phone: "8711234567" }, ctx);
    expect(dup).toMatchObject({ kind: "prospect", id: "p1", name: "Ana López", stage: "contactado", advisor_name: "Luis", matched: "phone", mine: true });
  });

  it("encuentra por correo y también clientes", () => {
    expect(findDuplicates({ email: "ANA@mail.com" }, ctx)[0]).toMatchObject({ id: "p1", matched: "email" });
    expect(findDuplicates({ phone: "871 555 0000" }, ctx)[0]).toMatchObject({ kind: "client", id: "c1", name: "Carla" });
  });

  it("un asesor ve que existe un prospecto ajeno pero sin su id", () => {
    const [dup] = findDuplicates({ phone: "8719990000" }, { ...ctx, myAdvisorId: "a1" });
    expect(dup).toMatchObject({ kind: "prospect", id: null, mine: false, advisor_name: "Rosa" });
  });

  it("la oficina (sin asesor) ve todos con su id", () => {
    expect(findDuplicates({ phone: "8719990000" }, ctx)[0]).toMatchObject({ id: "p2", mine: true });
  });

  it("no se cuenta a sí mismo al editar", () => {
    expect(findDuplicates({ phone: "8711234567" }, { ...ctx, excludeProspectId: "p1" })).toEqual([]);
  });

  it("sin teléfono de 10 dígitos ni correo no hay nada que comparar", () => {
    expect(findDuplicates({ phone: "123", email: "" }, ctx)).toEqual([]);
  });

  it("un teléfono vacío en la base no coincide con uno vacío", () => {
    expect(findDuplicates({ phone: "", email: "otro@mail.com" }, ctx)).toEqual([]);
  });
});
