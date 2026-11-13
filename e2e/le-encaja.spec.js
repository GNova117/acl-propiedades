import { test, expect, expectHealthyPage } from "./fixtures.js";

// «Le encaja a tus prospectos» (Mi día): una propiedad nueva o con rebaja esta semana, con los prospectos a los que les va con lo que
// buscan, su WhatsApp ya escrito y el registro del contacto. Lo revisado se recuerda en este dispositivo y la campana lo cuenta.

const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

const propiedad = (id, title, extra = {}) => ({
  id,
  code: id.toUpperCase(),
  title,
  type: "casa",
  description: "Casa de prueba",
  price: 1500000,
  area_m2: 120,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  zone: "Lerdo",
  address: "Calle de prueba 1, Lerdo",
  lat: 25.54,
  lng: -103.52,
  status: "disponible",
  operation_type: "compra",
  active: true,
  main_image: "",
  images: [],
  advisor_ids: ["advisor-1"],
  created_at: hace(24 * 60),
  updated_at: hace(24 * 60),
  ...extra,
});

const prospecto = (id, name, criteria, extra = {}) => ({
  id,
  name,
  phone: "8715550101",
  email: null,
  source: "manual",
  stage: "interesado",
  advisor_id: "advisor-1",
  property_id: null,
  looking_for: null,
  notes: null,
  search_criteria: criteria,
  last_contact_at: hace(48),
  next_followup_at: null,
  lost_reason: null,
  created_at: hace(24 * 20),
  updated_at: hace(48),
  ...extra,
});

const BUSCA_LERDO = { type: "casa", zone: "Lerdo", max_price: 1800000 };

test.describe("Le encaja a tus prospectos", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("una propiedad nueva sale con el prospecto al que le encaja (no con el que no), con su WhatsApp ya escrito", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [propiedad("prop-nueva", "Casa Nueva QA", { created_at: hace(5) }), propiedad("prop-vieja", "Casa Vieja QA")]);
    await poner(page, "acl_local_prospectos", [prospecto("p1", "Ana Encaja QA", BUSCA_LERDO), prospecto("p2", "Luis NoEncaja QA", { type: "terreno" }), prospecto("p3", "Sin Criterios QA", {})]);
    await go("/admin/mi-dia");

    const seccion = page.locator("section", { has: page.getByRole("heading", { name: /Le encaja a tus prospectos/ }) });
    await expect(seccion).toBeVisible();
    const tarjeta = seccion.locator(".match-alert", { hasText: "Casa Nueva QA" });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator(".prospect-chip", { hasText: "Nueva" })).toBeVisible();
    await expect(tarjeta.getByText("Ana Encaja QA")).toBeVisible();
    await expect(tarjeta.getByText("Busca: Tipo: Casa")).toBeVisible();
    await expect(seccion.getByText("Luis NoEncaja QA")).toHaveCount(0);
    await expect(seccion.getByText("Sin Criterios QA")).toHaveCount(0);
    await expect(seccion.getByText("Casa Vieja QA")).toHaveCount(0); // no es novedad: tiene dos meses

    const whatsapp = tarjeta.getByRole("link", { name: "WhatsApp" });
    const href = await whatsapp.getAttribute("href");
    expect(href).toContain("https://wa.me/528715550101?text=");
    const texto = decodeURIComponent(href.split("text=")[1]);
    expect(texto).toContain("Hola Ana");
    expect(texto).toContain("Casa Nueva QA");
    expect(texto).toContain("/propiedades/prop-nueva");
    expect(texto).not.toContain("bajar de precio");
    await expectHealthyPage(page);
  });

  test("mandar el WhatsApp abre «Registrar contacto»; al guardarlo, ese prospecto sale y no vuelve al recargar", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [propiedad("prop-nueva", "Casa Nueva QA", { created_at: hace(5) })]);
    await poner(page, "acl_local_prospectos", [prospecto("p1", "Ana Encaja QA", BUSCA_LERDO), prospecto("p2", "Beto Encaja QA", BUSCA_LERDO, { phone: "8715550202" })]);
    await go("/admin/mi-dia");

    const tarjeta = page.locator(".match-alert", { hasText: "Casa Nueva QA" });
    const fila = tarjeta.locator(".match-alert__prospect", { hasText: "Ana Encaja QA" });
    // El enlace se abriría en otra pestaña (y WhatsApp está bloqueado en las pruebas): se cancela la navegación, el clic de la app sí corre.
    await fila.getByRole("link", { name: "WhatsApp" }).evaluate((a) => a.addEventListener("click", (e) => e.preventDefault(), true));
    await press(fila.getByRole("link", { name: "WhatsApp" }));

    const formulario = fila.getByRole("form", { name: "Registrar contacto" });
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole("radio", { name: "WhatsApp" })).toBeChecked();
    await press(formulario.getByRole("button", { name: "Interesado" }).first());

    await expect(tarjeta.getByText("Ana Encaja QA")).toHaveCount(0);
    await expect(tarjeta.getByText("Beto Encaja QA")).toBeVisible();
    const contactos = await page.evaluate(() => JSON.parse(localStorage.getItem("acl_local_prospect_contacts") || "[]"));
    expect(contactos.some((c) => c.prospecto_id === "p1" && c.channel === "whatsapp")).toBe(true);

    await go("/admin/mi-dia");
    await expect(page.locator(".match-alert", { hasText: "Casa Nueva QA" }).getByText("Beto Encaja QA")).toBeVisible();
    await expect(page.getByText("Ana Encaja QA")).toHaveCount(0);
  });

  test("«Ya le escribí» y «Listo» quitan al prospecto o la propiedad; con todo revisado la sección desaparece", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [propiedad("prop-nueva", "Casa Nueva QA", { created_at: hace(5) })]);
    await poner(page, "acl_local_prospectos", [prospecto("p1", "Ana Encaja QA", BUSCA_LERDO), prospecto("p2", "Beto Encaja QA", BUSCA_LERDO)]);
    await go("/admin/mi-dia");

    const tarjeta = page.locator(".match-alert", { hasText: "Casa Nueva QA" });
    await press(tarjeta.locator(".match-alert__prospect", { hasText: "Ana Encaja QA" }).getByRole("button", { name: "Ya le escribí" }));
    await expect(tarjeta.getByText("Ana Encaja QA")).toHaveCount(0);
    await expect(tarjeta.getByText("Beto Encaja QA")).toBeVisible();

    await press(tarjeta.getByRole("button", { name: "Listo, ya la revisé" }));
    await expect(page.getByRole("heading", { name: /Le encaja a tus prospectos/ })).toHaveCount(0);
    await go("/admin/mi-dia");
    await expect(page.getByRole("heading", { name: /Le encaja a tus prospectos/ })).toHaveCount(0);
  });

  test("una rebaja se anuncia como tal, con el porcentaje, el precio anterior y el mensaje que lo dice", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [propiedad("prop-rebaja", "Casa Rebaja QA", { price: 1350000, previous_price: 1500000, price_changed_at: hace(20) })]);
    await poner(page, "acl_local_prospectos", [prospecto("p1", "Ana Encaja QA", BUSCA_LERDO)]);
    await go("/admin/mi-dia");

    const tarjeta = page.locator(".match-alert", { hasText: "Casa Rebaja QA" });
    await expect(tarjeta.locator(".prospect-chip", { hasText: "Bajó 10 %" })).toBeVisible();
    await expect(tarjeta.getByText(/antes \$1,500,000/)).toBeVisible();
    const href = await tarjeta.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
    expect(decodeURIComponent(href.split("text=")[1])).toContain("acaba de bajar de precio (10 % menos)");
  });

  test("la campana cuenta las propiedades por revisar y lleva a Mi día", async ({ page, go, press }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [propiedad("prop-nueva", "Casa Nueva QA", { created_at: hace(5) })]);
    await poner(page, "acl_local_prospectos", [prospecto("p1", "Ana Encaja QA", BUSCA_LERDO)]);
    await go("/admin/panel");

    await press(page.getByRole("button", { name: "Notificaciones" }));
    const item = page.locator(".notification-bell__item", { hasText: "Propiedades que le encajan a tus prospectos" });
    await expect(item).toBeVisible();
    await expect(item.locator(".notification-bell__item-count")).toHaveText("1");
    await press(item);
    await expect(page).toHaveURL(/\/admin\/mi-dia$/);
  });
});
