import { describe, expect, it } from "vitest";
import { ACTIVITY_KEY, DEFAULT_IDLE_MINUTES, idleLimitMs, idleState, readLastActivity, writeLastActivity } from "./idleSession";

const MIN = 60_000;

describe("idleLimitMs", () => {
  it("por omisión 30 minutos; la variable la cambia y 0 la apaga", () => {
    expect(idleLimitMs(undefined)).toBe(DEFAULT_IDLE_MINUTES * MIN);
    expect(idleLimitMs("")).toBe(30 * MIN);
    expect(idleLimitMs("10")).toBe(10 * MIN);
    expect(idleLimitMs("0")).toBe(0);
    expect(idleLimitMs("-5")).toBe(0);
    expect(idleLimitMs("abc")).toBe(0);
  });
  it("el gancho de pruebas manda sobre la variable", () => {
    expect(idleLimitMs("30", 5000)).toBe(5000);
    expect(idleLimitMs("30", 0)).toBe(30 * MIN);
  });
});

const T1 = 1_700_000_000_000;

describe("idleState", () => {
  const limit = 30 * MIN;
  const T0 = 1_700_000_000_000; // última actividad
  it("activo, con aviso en el último minuto y vencido", () => {
    expect(idleState(T0, T0 + 10 * MIN, limit).state).toBe("active");
    expect(idleState(T0, T0 + 29 * MIN + 1, limit)).toEqual({ state: "warning", remainingMs: MIN - 1 });
    expect(idleState(T0, T0 + 30 * MIN, limit).state).toBe("expired");
    expect(idleState(T0, T0 + 45 * MIN, limit).state).toBe("expired");
  });
  it("apagado (límite 0) nunca vence, y sin marca de actividad cuenta desde ahora", () => {
    expect(idleState(1, 10 ** 12, 0).state).toBe("active");
    expect(idleState(null, 10 ** 12, limit).state).toBe("active");
  });
  it("con un límite más corto que el aviso, el aviso cabe dentro del límite", () => {
    expect(idleState(T1, T1, 5000).state).toBe("active"); // recién tocado
    expect(idleState(T1, T1 + 1, 5000).state).toBe("warning"); // casi todo el límite es aviso
    expect(idleState(T1, T1 + 5000, 5000).state).toBe("expired");
  });
});

describe("marca compartida entre pestañas", () => {
  it("se escribe y se lee, y tolera almacenamiento roto", () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    expect(readLastActivity(storage)).toBeNull();
    writeLastActivity(12345, storage);
    expect(data.get(ACTIVITY_KEY)).toBe("12345");
    expect(readLastActivity(storage)).toBe(12345);
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(readLastActivity(broken)).toBeNull();
    expect(() => writeLastActivity(1, broken)).not.toThrow();
  });
});
