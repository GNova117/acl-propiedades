import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkCronSecret, deriveCronSecret, safeEqual } from "./cronAuth";

const MASTER = "frase-larga-y-aleatoria-de-prueba";

describe("deriveCronSecret", () => {
  it("es el HMAC-SHA256 en hexadecimal del nombre de la función con el secreto maestro (igual que cron_secret_for en SQL)", async () => {
    const expected = createHmac("sha256", MASTER).update("enviar-push").digest("hex");
    expect(await deriveCronSecret(MASTER, "enviar-push")).toBe(expected);
  });

  it("cada función tiene el suyo y ninguno es el maestro", async () => {
    const a = await deriveCronSecret(MASTER, "enviar-push");
    const b = await deriveCronSecret(MASTER, "visita-correo");
    expect(a).not.toBe(b);
    expect(a).not.toBe(MASTER);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("checkCronSecret", () => {
  it("acepta el secreto de la propia función", async () => {
    const own = await deriveCronSecret(MASTER, "enviar-push");
    expect(await checkCronSecret(own, "enviar-push", { master: MASTER, acceptShared: false })).toBe(true);
  });

  it("rechaza el secreto de OTRA función: si se filtra uno, no abre los demás", async () => {
    const other = await deriveCronSecret(MASTER, "visita-correo");
    expect(await checkCronSecret(other, "enviar-push", { master: MASTER })).toBe(false);
    expect(await checkCronSecret(other, "enviar-push", { master: MASTER, acceptShared: false })).toBe(false);
  });

  it("en transición acepta el secreto maestro tal cual; apagada la transición, ya no", async () => {
    expect(await checkCronSecret(MASTER, "enviar-push", { master: MASTER, acceptShared: true })).toBe(true);
    expect(await checkCronSecret(MASTER, "enviar-push", { master: MASTER, acceptShared: false })).toBe(false);
  });

  it("rechaza vacío, sin encabezado o sin secreto maestro configurado", async () => {
    expect(await checkCronSecret("", "enviar-push", { master: MASTER })).toBe(false);
    expect(await checkCronSecret(null, "enviar-push", { master: MASTER })).toBe(false);
    expect(await checkCronSecret("x", "enviar-push", { master: undefined })).toBe(false);
    expect(await checkCronSecret("", "enviar-push", { master: "" })).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compara cadenas completas", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
