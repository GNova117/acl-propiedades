// @vitest-environment jsdom
// 493: la tarjeta «¿Te interesa esta propiedad?» de la ficha (nombre y teléfono → mensaje a Mensajes con la propiedad).
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { resetSharedContact } from "../lib/sharedContact";

const submitContactMessage = vi.fn();
vi.mock("../lib/dataStore", () => ({ db: { submitContactMessage: (...args) => submitContactMessage(...args) } }));
vi.mock("../lib/conversions", () => ({ trackConversion: vi.fn() }));

const { default: ContactRequestCard } = await import("./ContactRequestCard");

const property = { id: "p1", code: "ACL-1001", title: "Casa en Senderos", slug: "casa-en-senderos" };

const renderCard = () =>
  render(
    <MemoryRouter>
      <ContactRequestCard property={property} />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  resetSharedContact(); // lo compartido entre formularios vive en memoria del módulo: cada prueba parte de cero
  submitContactMessage.mockReset();
  submitContactMessage.mockResolvedValue({});
});
afterEach(cleanup);

describe("ContactRequestCard", () => {
  it("pide nombre y un teléfono de al menos 10 dígitos antes de enviar", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Quiero que me contacten" }));
    expect(submitContactMessage).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Nombre completo"), "Ana");
    await user.type(screen.getByLabelText("Teléfono"), "12345");
    await user.click(screen.getByRole("button", { name: "Quiero que me contacten" }));
    expect(submitContactMessage).not.toHaveBeenCalled();
    expect(screen.getByText("Escribe un teléfono de al menos 10 dígitos")).toBeInTheDocument();
  });

  it("con datos válidos manda la solicitud ligada a la propiedad y agradece", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText("Nombre completo"), "Ana López");
    await user.type(screen.getByLabelText("Teléfono"), "871 123 4567");
    await user.click(screen.getByRole("button", { name: "Quiero que me contacten" }));
    await waitFor(() => expect(submitContactMessage).toHaveBeenCalledTimes(1));
    const payload = submitContactMessage.mock.calls[0][0];
    expect(payload).toMatchObject({ name: "Ana López", phone: "871 123 4567", property_id: "p1" });
    expect(payload.message).toContain("ACL-1001");
    expect(await screen.findByText("¡Listo! Un asesor te contactará muy pronto.")).toBeInTheDocument();
  });
});
