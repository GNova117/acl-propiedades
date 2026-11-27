import { describe, expect, it } from "vitest";
import { expedienteStatus } from "./clientExpedienteStatus";

const full = {
  name: "Ana",
  phone: "8711234567",
  email: "a@b.com",
  fecha_nacimiento: "1990-01-01",
  estado_civil: "soltero",
  domicilio: "Calle 1",
  rfc: "AAAA900101AAA",
  curp: "AAAA900101HCOXXX00",
  identificacion_oficial: "123",
  type: "vendedor",
};

describe("expedienteStatus", () => {
  it("completo → verde", () => {
    const s = expedienteStatus(full);
    expect(s.level).toBe("ok");
    expect(s.missing).toEqual([]);
    expect(s.filled).toBe(s.total);
  });
  it("faltan uno o dos datos → amarillo, con sus etiquetas", () => {
    const s = expedienteStatus({ ...full, rfc: "", curp: " " });
    expect(s.level).toBe("mid");
    expect(s.missing.map((m) => m.label)).toEqual(["RFC", "CURP"]);
  });
  it("faltan muchos → rojo", () => {
    expect(expedienteStatus({ name: "Ana", type: "vendedor" }).level).toBe("low");
  });
  it("con INFONAVIT también se exige el NSS del comprador", () => {
    const s = expedienteStatus({ ...full, type: "comprador", financiamiento: "infonavit" });
    expect(s.missing.map((m) => m.key)).toContain("nss");
  });
  it("sin datos del cliente no truena", () => {
    expect(expedienteStatus(null).level).toBe("low");
  });
});
