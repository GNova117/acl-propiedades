import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  dataUrlToBase64,
  effectiveStatus,
  signingAgeDays,
  SIGNING_CODE_MAX_ATTEMPTS,
  signingReminderText,
  signingWhatsappText,
} from "./signing";

describe("bytesToBase64 / base64ToBytes", () => {
  it("son inversas entre sí", () => {
    const original = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
    const roundTripped = base64ToBytes(bytesToBase64(original));
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });

  it("funciona con arreglos grandes (más de un bloque de conversión)", () => {
    const original = new Uint8Array(100000).map((_, i) => i % 256);
    const roundTripped = base64ToBytes(bytesToBase64(original));
    expect(roundTripped.length).toBe(original.length);
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });
});

describe("dataUrlToBase64", () => {
  it("se queda solo con la parte después de la coma", () => {
    expect(dataUrlToBase64("data:image/png;base64,AAAA")).toBe("AAAA");
  });

  it("devuelve cadena vacía si no hay coma", () => {
    expect(dataUrlToBase64("no-es-data-url")).toBe("");
  });
});

describe("effectiveStatus", () => {
  it("un estado que no es 'pendiente' se devuelve tal cual (firmado/cancelado)", () => {
    expect(effectiveStatus({ status: "firmado" })).toBe("firmado");
    expect(effectiveStatus({ status: "cancelado" })).toBe("cancelado");
  });

  it("pendiente con vigencia vencida es 'expirado'", () => {
    expect(effectiveStatus({ status: "pendiente", expires_at: "2020-01-01T00:00:00Z" })).toBe("expirado");
  });

  it("pendiente sin vencer pero con demasiados intentos fallidos es 'bloqueado'", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(effectiveStatus({ status: "pendiente", expires_at: future, failed_attempts: SIGNING_CODE_MAX_ATTEMPTS })).toBe("bloqueado");
  });

  it("pendiente, vigente y sin intentos agotados sigue 'pendiente'", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(effectiveStatus({ status: "pendiente", expires_at: future, failed_attempts: SIGNING_CODE_MAX_ATTEMPTS - 1 })).toBe("pendiente");
  });
});

describe("signingAgeDays", () => {
  it("cuenta días completos desde la creación", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(signingAgeDays({ created_at: threeDaysAgo })).toBe(3);
  });
});

describe("signingWhatsappText / signingReminderText", () => {
  beforeAll(() => {
    vi.stubGlobal("window", { location: { origin: "https://acl.test" } });
  });

  it("el mensaje de envío lleva el enlace pero nunca el código (se da por separado)", () => {
    const text = signingWhatsappText({ signer_name: "Ana", title: "Contrato", token: "abc123" });
    expect(text).toContain("Ana");
    expect(text).toContain("Contrato");
    expect(text).toContain("https://acl.test/firmar/abc123");
    expect(text.toLowerCase()).not.toContain("código: ");
  });

  it("el recordatorio es un mensaje distinto al de envío inicial", () => {
    const sent = signingWhatsappText({ signer_name: "Ana", title: "Contrato", token: "abc123" });
    const reminder = signingReminderText({ signer_name: "Ana", title: "Contrato", token: "abc123" });
    expect(reminder).not.toBe(sent);
    expect(reminder).toContain("pendiente");
  });
});
