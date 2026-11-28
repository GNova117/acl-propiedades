// @vitest-environment jsdom
// 290: el menú de compartir (escritorio) se cierra al tocar fuera, con Escape y al elegir una opción.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";

vi.mock("../lib/dataStore", () => ({ db: { trackPropertyEvent: vi.fn() } }));
vi.mock("../lib/conversions", () => ({ trackConversion: vi.fn() }));

const { default: ShareButton } = await import("./ShareButton");

beforeEach(() => {
  delete navigator.share; // sin hoja nativa: se usa el menú <details>
});
afterEach(cleanup);

const renderMenu = () =>
  render(
    <div>
      <ShareButton title="Casa" url="https://acl.mx/propiedades/1" />
      <button type="button">fuera</button>
    </div>,
  );

const menu = (container) => container.querySelector("details");

describe("menú de compartir", () => {
  it("se abre y se cierra al tocar fuera", () => {
    const { container } = renderMenu();
    menu(container).open = true;
    fireEvent.pointerDown(screen.getByText("fuera"));
    expect(menu(container).open).toBe(false);
  });
  it("tocar dentro del menú no lo cierra", () => {
    const { container } = renderMenu();
    menu(container).open = true;
    fireEvent.pointerDown(container.querySelector(".share-button__menu"));
    expect(menu(container).open).toBe(true);
  });
  it("Escape lo cierra y devuelve el foco al botón", () => {
    const { container } = renderMenu();
    menu(container).open = true;
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu(container).open).toBe(false);
    expect(container.querySelector("summary")).toHaveFocus();
  });
  it("elegir WhatsApp lo cierra", () => {
    const { container } = renderMenu();
    menu(container).open = true;
    fireEvent.click(screen.getByText("WhatsApp"));
    expect(menu(container).open).toBe(false);
  });
});
