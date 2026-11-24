import { describe, expect, it } from "vitest";
import { deviceLabel, getDeviceId } from "./deviceInfo";

describe("deviceLabel", () => {
  it("nombra navegador y sistema", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")).toBe("Chrome en Windows");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0")).toBe("Edge en Windows");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari en iPhone");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36")).toBe("Chrome en Android");
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/127.0")).toBe("Firefox en Mac");
  });
  it("sin datos devuelve algo legible", () => {
    expect(deviceLabel("")).toBe("Navegador");
    expect(deviceLabel(null)).toBe("Navegador");
  });
});

describe("getDeviceId", () => {
  it("crea un identificador, lo guarda y lo reutiliza", () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const first = getDeviceId(storage);
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(getDeviceId(storage)).toBe(first);
  });
  it("sin almacenamiento da uno temporal válido", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(getDeviceId(broken).length).toBeGreaterThanOrEqual(8);
  });
});
