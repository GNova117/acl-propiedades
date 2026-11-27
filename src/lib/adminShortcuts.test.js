import { describe, expect, it } from "vitest";
import { GO_TARGETS, isTypingTarget, nextShortcutState } from "./adminShortcuts";

describe("nextShortcutState", () => {
  it("G y luego P lleva a Prospectos", () => {
    const first = nextShortcutState({ pendingAt: 0 }, "g", 1000);
    expect(first.pendingAt).toBe(1000);
    expect(nextShortcutState(first, "p", 1500).target).toBe(GO_TARGETS.p);
  });
  it("pasado el plazo, o sin G antes, no hace nada", () => {
    expect(nextShortcutState({ pendingAt: 1000 }, "p", 3000).target).toBeUndefined();
    expect(nextShortcutState({ pendingAt: 0 }, "p", 1000).target).toBeUndefined();
  });
  it("escribiendo en un campo o con Ctrl/Cmd no se activa", () => {
    expect(nextShortcutState({ pendingAt: 1000 }, "p", 1200, { typing: true }).target).toBeUndefined();
    expect(nextShortcutState({ pendingAt: 0 }, "g", 1000, { modifier: true }).pendingAt).toBe(0);
  });
  it("una letra que no es destino cancela la secuencia", () => {
    expect(nextShortcutState({ pendingAt: 1000 }, "z", 1200)).toEqual({ pendingAt: 0 });
  });
});

describe("isTypingTarget", () => {
  it("campos de texto sí, botones no", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
