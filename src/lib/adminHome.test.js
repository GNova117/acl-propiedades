import { describe, expect, it } from "vitest";
import { HOME_MY_DAY, HOME_PANEL, MAX_TABS, mobileTabs, resolveAdminHome } from "./adminHome";

const sections = (...keys) => (key) => keys.includes(key);

describe("pantalla de inicio del panel", () => {
  it("un asesor arranca en Mi día", () => {
    expect(resolveAdminHome({ stored: null, advisorId: "adv-1", canMyDay: true })).toBe(HOME_MY_DAY);
  });

  it("la oficina (sin asesor ligado) arranca en el Panel principal", () => {
    expect(resolveAdminHome({ stored: null, advisorId: null, canMyDay: true })).toBe(HOME_PANEL);
  });

  it("respeta lo que la persona eligió en este dispositivo", () => {
    expect(resolveAdminHome({ stored: HOME_PANEL, advisorId: "adv-1", canMyDay: true })).toBe(HOME_PANEL);
    expect(resolveAdminHome({ stored: HOME_MY_DAY, advisorId: null, canMyDay: true })).toBe(HOME_MY_DAY);
  });

  it("sin agenda ni prospectos no puede abrir en Mi día, aunque lo haya elegido", () => {
    expect(resolveAdminHome({ stored: HOME_MY_DAY, advisorId: "adv-1", canMyDay: false })).toBe(HOME_PANEL);
  });

  it("ignora un valor guardado que no reconoce", () => {
    expect(resolveAdminHome({ stored: "otra-cosa", advisorId: "adv-1", canMyDay: true })).toBe(HOME_MY_DAY);
  });
});

describe("barra de abajo en el teléfono", () => {
  const keys = (tabs) => tabs.map((t) => t.key);

  it("un asesor con todo ve Mi día, Prospectos, Agenda y Clientes", () => {
    const all = sections("agenda", "prospectos", "clientes", "propiedades", "mensajes");
    expect(keys(mobileTabs({ hasSection: all, home: HOME_MY_DAY }))).toEqual(["myDay", "prospects", "agenda", "clients"]);
  });

  it("nunca pasa de cuatro pestañas (más el botón «Más»)", () => {
    const all = sections("agenda", "prospectos", "clientes", "propiedades", "mensajes");
    expect(mobileTabs({ hasSection: all, home: HOME_PANEL }).length).toBeLessThanOrEqual(MAX_TABS);
  });

  it("si el inicio es el Panel principal, va primero en lugar de Mi día", () => {
    const tabs = mobileTabs({ hasSection: sections("agenda", "prospectos", "clientes"), home: HOME_PANEL });
    expect(keys(tabs)).toEqual(["home", "prospects", "agenda", "clients"]);
    expect(tabs[0].to).toBe("/admin");
  });

  it("solo muestra lo que el rol tiene y completa con otras de uso frecuente", () => {
    expect(keys(mobileTabs({ hasSection: sections("propiedades", "mensajes"), home: HOME_PANEL }))).toEqual(["home", "properties", "messages"]);
  });
});
