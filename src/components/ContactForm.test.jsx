// @vitest-environment jsdom
// 493: prueba de componente del formulario crítico de Contacto (Testing Library + jsdom): validación, anti-spam, envío y el
// recuerdo de datos. La base de datos se sustituye por un doble; todo lo demás es el componente real.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";

const submitContactMessage = vi.fn();
vi.mock("../lib/dataStore", () => ({ db: { submitContactMessage: (...args) => submitContactMessage(...args) } }));
vi.mock("../lib/conversions", () => ({ trackConversion: vi.fn() }));

const { default: ContactForm } = await import("./ContactForm");

const renderForm = (props = {}, route = "/contacto") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <ContactForm {...props} />
    </MemoryRouter>,
  );

async function fillValid(user) {
  await user.type(screen.getByLabelText("Nombre completo"), "María Prueba");
  await user.type(screen.getByLabelText("Correo electrónico"), "maria@example.com");
  await user.type(screen.getByLabelText("Teléfono"), "8715550123");
  await user.type(screen.getByLabelText("Mensaje"), "Quiero información");
}

beforeEach(() => {
  localStorage.clear();
  submitContactMessage.mockReset();
  submitContactMessage.mockResolvedValue({});
});
afterEach(cleanup);

describe("ContactForm", () => {
  it("sin datos no envía y marca los campos obligatorios", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(submitContactMessage).not.toHaveBeenCalled();
    expect(screen.getAllByText("Este campo es obligatorio").length).toBeGreaterThanOrEqual(3);
  });

  it("rechaza un correo y un teléfono con mal formato", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Nombre completo"), "Ana");
    await user.type(screen.getByLabelText("Correo electrónico"), "no-es-correo");
    await user.type(screen.getByLabelText("Teléfono"), "123");
    await user.type(screen.getByLabelText("Mensaje"), "Hola");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(submitContactMessage).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Teléfono")).toHaveAttribute("aria-invalid", "true");
  });

  it("con datos válidos envía el mensaje (sin el campo trampa) y muestra el éxito", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => expect(submitContactMessage).toHaveBeenCalledTimes(1));
    const payload = submitContactMessage.mock.calls[0][0];
    expect(payload).toMatchObject({ name: "María Prueba", email: "maria@example.com", phone: "8715550123", message: "Quiero información" });
    expect(payload).not.toHaveProperty("empresa");
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("un bot que llena el campo trampa ve «éxito» pero no se guarda nada", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await fillValid(user);
    await user.type(container.querySelector("#contact-empresa"), "Spam S.A.");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(submitContactMessage).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("el motivo elegido viaja como prefijo del mensaje", async () => {
    const user = userEvent.setup();
    renderForm({}, "/contacto?motivo=rentar_mia");
    expect(screen.getByLabelText("¿Qué buscas?")).toHaveValue("rentar_mia");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => expect(submitContactMessage).toHaveBeenCalled());
    expect(submitContactMessage.mock.calls[0][0].message).toBe("[Quiero rentar mi propiedad] Quiero información");
  });

  it("recuerda nombre, correo y teléfono para la próxima vez", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => expect(submitContactMessage).toHaveBeenCalled());
    cleanup();
    renderForm();
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("María Prueba");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("8715550123");
  });

  it("un segundo envío seguido se frena en el navegador", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => expect(submitContactMessage).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole("button", { name: /otro mensaje/i }));
    await user.type(screen.getByLabelText("Mensaje"), "Otro");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(submitContactMessage).toHaveBeenCalledTimes(1);
  });

  it("con errores liga cada campo a su mensaje y manda el foco al primero (261)", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    const name = screen.getByLabelText("Nombre completo");
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("aria-describedby", "contact-name-error");
    expect(document.getElementById("contact-name-error")).toHaveTextContent("Este campo es obligatorio");
  });
});
