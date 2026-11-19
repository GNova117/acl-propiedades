import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, dismissUntil, shouldShowInstallBanner } from "./installBanner";

const NOW = 1_800_000_000_000;
const base = { views: 3, dismissedUntil: 0, now: NOW, standalone: false, canPrompt: true, ios: false };

describe("shouldShowInstallBanner", () => {
  it("se ofrece tras recorrer el sitio, cuando el navegador puede instalarla", () => {
    expect(shouldShowInstallBanner(base)).toBe(true);
    expect(shouldShowInstallBanner({ ...base, canPrompt: false, ios: true })).toBe(true);
  });
  it("no estorba: no antes de la segunda página, no si ya está instalada, no si dijo «ahora no»", () => {
    expect(shouldShowInstallBanner({ ...base, views: 1 })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, standalone: true })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, dismissedUntil: NOW + 1000 })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, dismissedUntil: NOW - 1000 })).toBe(true);
  });
  it("sin posibilidad de instalar (ni aviso del navegador ni iPhone), nada", () => {
    expect(shouldShowInstallBanner({ ...base, canPrompt: false })).toBe(false);
  });
  it("«ahora no» se recuerda 30 días", () => {
    expect(dismissUntil(NOW)).toBe(NOW + DISMISS_DAYS * 86400000);
    expect(DISMISS_DAYS).toBe(30);
  });
});
