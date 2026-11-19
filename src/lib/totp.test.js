import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, otpauthUri, totpCode, verifyTotp } from "./totp";

// Secreto de prueba del RFC 6238 (ASCII "12345678901234567890") y sus vectores con 8 dígitos; con 6 son los últimos 6.
const RFC_SECRET = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("totp", () => {
  it("coincide con los vectores del RFC 6238 (SHA-1)", async () => {
    const vectors = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
    ];
    for (const [seconds, expected] of vectors) {
      expect(await totpCode(RFC_SECRET, seconds * 1000, 8)).toBe(expected);
      expect(await totpCode(RFC_SECRET, seconds * 1000, 6)).toBe(expected.slice(-6));
    }
  });

  it("base32 va y viene sin perder bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 17, 33]);
    expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
    expect(base32Encode(new TextEncoder().encode("foobar"))).toBe("MZXW6YTBOI");
  });

  it("verifica el código de ahora y tolera un paso de desfase, pero no más", async () => {
    const now = 1_700_000_000_000;
    const code = await totpCode(RFC_SECRET, now);
    expect(await verifyTotp(RFC_SECRET, code, now)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, code, now + 30_000)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, code, now - 30_000)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, code, now + 90_000)).toBe(false);
  });

  it("rechaza lo que no es un código de 6 dígitos", async () => {
    for (const bad of ["", "12345", "1234567", "abcdef", null, undefined]) expect(await verifyTotp(RFC_SECRET, bad)).toBe(false);
    const code = await totpCode(RFC_SECRET, 1_700_000_000_000);
    expect(await verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, 1_700_000_000_000)).toBe(true); // con espacio, como se copia
  });

  it("arma la dirección otpauth con el correo y la marca", () => {
    const uri = otpauthUri("ABC234", "ana@correo.com");
    expect(uri).toBe("otpauth://totp/ACL%20Propiedades%3Aana%40correo.com?secret=ABC234&issuer=ACL%20Propiedades&algorithm=SHA1&digits=6&period=30");
  });
});
