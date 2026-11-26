import { describe, expect, it } from "vitest";
import i18n, { ensureLanguage } from "./index";
import en from "./locales/en.json";
import { FACTORY_EN, applyPropertyTypeLabels } from "../lib/propertyTypeLabels";

describe("inglés bajo demanda", () => {
  it("el inglés de fábrica de los tipos coincide con en.json", () => {
    expect(FACTORY_EN).toEqual(en.propertyType);
  });

  it("al arrancar solo está el español; el inglés llega con ensureLanguage", async () => {
    expect(i18n.hasResourceBundle("es", "translation")).toBe(true);
    expect(i18n.getResource("en", "translation", "nav")).toBeUndefined();
    await ensureLanguage("en");
    expect(i18n.getResource("en", "translation", "nav")).toEqual(en.nav);
    await ensureLanguage("en"); // idempotente
  });

  it("un nombre de tipo editado en el panel no se pisa al cargar el inglés después", async () => {
    // Se inyecta primero el nombre del admin (como hace App.jsx al arrancar) y luego se carga el inglés completo.
    applyPropertyTypeLabels([{ key: "casa", label: "Residencia" }]);
    i18n.removeResourceBundle("en", "translation");
    applyPropertyTypeLabels([{ key: "casa", label: "Residencia" }]);
    await ensureLanguage("en");
    expect(i18n.getResource("en", "translation", "propertyType.casa")).toBe("Residencia");
    expect(i18n.getResource("en", "translation", "propertyType.terreno")).toBe("Land");
  });
});
