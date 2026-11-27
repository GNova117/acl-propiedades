// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { syncScrollableRegions } from "./scrollableRegions";

function wrapper({ scroll, client }) {
  const el = document.createElement("div");
  el.className = "admin-table-wrapper";
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scroll });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: client });
  return el;
}

describe("syncScrollableRegions", () => {
  it("vuelve enfocable y con nombre la zona que se desborda", () => {
    const root = document.createElement("div");
    const el = wrapper({ scroll: 900, client: 400 });
    root.append(el);
    syncScrollableRegions(root, "Tabla");
    expect(el.getAttribute("tabindex")).toBe("0");
    expect(el.getAttribute("role")).toBe("region");
    expect(el.getAttribute("aria-label")).toBe("Tabla");
  });

  it("no toca la que cabe", () => {
    const root = document.createElement("div");
    const el = wrapper({ scroll: 400, client: 400 });
    root.append(el);
    syncScrollableRegions(root, "Tabla");
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(el.hasAttribute("role")).toBe(false);
  });

  it("la desmarca cuando deja de desbordarse, pero respeta lo que ya tenía puesto a mano", () => {
    const root = document.createElement("div");
    const auto = wrapper({ scroll: 900, client: 400 });
    const manual = wrapper({ scroll: 900, client: 400 });
    manual.setAttribute("tabindex", "0");
    manual.setAttribute("aria-label", "Mío");
    root.append(auto, manual);
    syncScrollableRegions(root, "Tabla");
    expect(manual.getAttribute("aria-label")).toBe("Mío");
    Object.defineProperty(auto, "scrollWidth", { configurable: true, value: 300 });
    Object.defineProperty(manual, "scrollWidth", { configurable: true, value: 300 });
    syncScrollableRegions(root, "Tabla");
    expect(auto.hasAttribute("tabindex")).toBe(false);
    expect(auto.hasAttribute("aria-label")).toBe(false);
    expect(manual.getAttribute("tabindex")).toBe("0"); // lo puso la pantalla, no este efecto
  });
});
