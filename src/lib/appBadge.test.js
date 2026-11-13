import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_BADGE, badgeSupported, clearAppBadge, setAppBadge } from "./appBadge";

afterEach(() => vi.unstubAllGlobals());

describe("appBadge", () => {
  it("sin Badging API no hace nada ni truena", () => {
    vi.stubGlobal("navigator", {});
    expect(badgeSupported()).toBe(false);
    expect(setAppBadge(5)).toBe(0);
    expect(clearAppBadge()).toBe(0);
  });

  it("pone el número, con tope de 99, y lo quita con 0, vacío o basura", () => {
    const setAppBadgeFn = vi.fn(() => Promise.resolve());
    const clearAppBadgeFn = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { setAppBadge: setAppBadgeFn, clearAppBadge: clearAppBadgeFn });
    expect(setAppBadge(7)).toBe(7);
    expect(setAppBadgeFn).toHaveBeenLastCalledWith(7);
    expect(setAppBadge(250)).toBe(MAX_BADGE);
    expect(setAppBadgeFn).toHaveBeenLastCalledWith(MAX_BADGE);
    for (const empty of [0, -3, "", null, undefined, "abc", NaN]) expect(setAppBadge(empty)).toBe(0);
    expect(clearAppBadgeFn).toHaveBeenCalledTimes(7);
    expect(setAppBadge(2.9)).toBe(2);
  });

  it("si el navegador rechaza la insignia (promesa o excepción) no se propaga", async () => {
    vi.stubGlobal("navigator", { setAppBadge: vi.fn(() => Promise.reject(new Error("no permitido"))), clearAppBadge: vi.fn() });
    expect(() => setAppBadge(3)).not.toThrow();
    await Promise.resolve();
    vi.stubGlobal("navigator", { setAppBadge: vi.fn(() => { throw new Error("boom"); }) });
    expect(setAppBadge(3)).toBe(0);
  });
});
