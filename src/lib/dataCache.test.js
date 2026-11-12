import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AGE, clearDataCache, mutate, peek, revalidate, snapshot, subscribe } from "./dataCache";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => clearDataCache());
afterEach(() => vi.useRealTimers());

describe("revalidate", () => {
  it("guarda lo que pide y avisa a quien lo está mostrando", async () => {
    const seen = vi.fn();
    subscribe("k", seen);
    const value = await revalidate("k", async () => [1, 2]);
    expect(value).toEqual([1, 2]);
    expect(peek("k")).toEqual([1, 2]);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("sin force, dos pantallas que piden lo mismo a la vez comparten una sola consulta", async () => {
    const fetcher = vi.fn(async () => "x");
    const a = revalidate("k", fetcher);
    const b = revalidate("k", fetcher);
    await Promise.all([a, b]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("con force sale otra consulta y solo cuenta la última", async () => {
    const first = deferred();
    const second = deferred();
    const a = revalidate("k", () => first.promise);
    const b = revalidate("k", () => second.promise, { force: true });
    second.resolve("nuevo");
    await b;
    first.resolve("viejo"); // llega tarde: ya no cuenta
    await a;
    expect(peek("k")).toBe("nuevo");
  });

  it("si falla, deja el error y conserva lo que ya había", async () => {
    await revalidate("k", async () => ["ya estaba"]);
    await expect(revalidate("k", async () => Promise.reject(new Error("sin red")))).rejects.toThrow("sin red");
    expect(snapshot("k").error.message).toBe("sin red");
    expect(peek("k")).toEqual(["ya estaba"]);
  });

  it("si falla la primera vez, no hay valor pero sí error (para no quedarse cargando)", async () => {
    await expect(revalidate("k", async () => Promise.reject(new Error("mal")))).rejects.toThrow("mal");
    expect(peek("k")).toBeUndefined();
    expect(snapshot("k").error.message).toBe("mal");
  });

  it("un resultado nuevo limpia el error anterior", async () => {
    await revalidate("k", async () => Promise.reject(new Error("mal"))).catch(() => {});
    await revalidate("k", async () => [1], { force: true });
    expect(snapshot("k").error).toBeNull();
  });
});

describe("mutate", () => {
  it("cambia la lista ya cargada con la función que recibe la actual", async () => {
    await revalidate("k", async () => [1, 2]);
    mutate("k", (list) => [...list, 3]);
    expect(peek("k")).toEqual([1, 2, 3]);
  });

  it("no hace nada si la lista todavía no se ha cargado", () => {
    mutate("k", (list) => [...list, 1]);
    expect(peek("k")).toBeUndefined();
  });

  it("una respuesta que salió antes del cambio se descarta (no lo borra)", async () => {
    await revalidate("k", async () => ["a"]);
    const slow = deferred();
    const pending = revalidate("k", () => slow.promise, { force: true });
    mutate("k", (list) => [...list, "b"]); // el usuario guardó algo mientras viajaba la consulta
    slow.resolve(["a"]); // trae la lista de antes del cambio
    await pending;
    expect(peek("k")).toEqual(["a", "b"]);
  });
});

describe("caducidad y limpieza", () => {
  it("una entrada de más de MAX_AGE no se usa", async () => {
    vi.useFakeTimers();
    await revalidate("k", async () => [1]);
    expect(peek("k")).toEqual([1]);
    vi.advanceTimersByTime(MAX_AGE + 1);
    expect(peek("k")).toBeUndefined();
    expect(snapshot("k")).toBeUndefined();
  });

  it("clearDataCache vacía todo y avisa a quien lo mostraba", async () => {
    await revalidate("a", async () => [1]);
    await revalidate("b", async () => [2]);
    const seen = vi.fn();
    subscribe("a", seen);
    clearDataCache();
    expect(peek("a")).toBeUndefined();
    expect(peek("b")).toBeUndefined();
    expect(seen).toHaveBeenCalled();
  });

  it("después de limpiar, una respuesta que venía en camino no revive datos de la otra cuenta", async () => {
    const slow = deferred();
    const pending = revalidate("k", () => slow.promise);
    clearDataCache(); // cerró sesión
    slow.resolve(["de la otra cuenta"]);
    await pending;
    expect(peek("k")).toBeUndefined();
  });
});
