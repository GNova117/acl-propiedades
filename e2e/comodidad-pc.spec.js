import { test, expect } from "./fixtures.js";

// Comodidad en computadora (Prospectos): arrastrar una tarjeta a otra columna cambia su etapa y la vista dividida deja la lista a la
// izquierda y la ficha a la derecha. En el teléfono nada de eso estorba: las tarjetas no se arrastran y no hay vista dividida.

const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), clave);

const prospecto = (id, name, stage, extra = {}) => ({
  id,
  name,
  phone: "8715550101",
  email: null,
  source: "manual",
  stage,
  advisor_id: "advisor-1",
  property_id: null,
  looking_for: null,
  notes: null,
  last_contact_at: hace(24),
  next_followup_at: null,
  lost_reason: null,
  created_at: hace(24 * 10),
  updated_at: hace(24),
  ...extra,
});

async function preparar(page, go) {
  await go("/admin/prospectos");
  await poner(page, "acl_local_prospectos", [prospecto("p1", "Ana Arrastre QA", "nuevo"), prospecto("p2", "Beto Arrastre QA", "contactado"), prospecto("p3", "Carla Arrastre QA", "interesado", { lost_reason: null })]);
  await go("/admin/prospectos");
  // La pantalla de carga inicial cubre la página unos segundos y se come el ratón: un arrastre empezado debajo no arranca.
  await expect(page.locator(".loading-screen")).toHaveCount(0, { timeout: 10_000 });
}

test.describe("Arrastrar entre columnas (computadora)", () => {
  test.beforeEach(async ({ seedAdminSession, isMobile }) => {
    test.skip(isMobile, "con el dedo no se arrastra: ahí se cambia la etapa con «Mover a…»");
    await seedAdminSession();
  });

  test("arrastrar una tarjeta a otra columna cambia su etapa y se guarda", async ({ page, go }) => {
    await preparar(page, go);
    await expect(page.locator(".prospect-drag-hint")).toBeVisible();
    const tarjeta = page.locator('.prospect-card[data-prospect="p1"]');
    await expect(tarjeta).toHaveAttribute("draggable", "true");

    await tarjeta.dragTo(page.locator('.prospect-col[data-stage="interesado"]'));
    await expect(page.locator('.prospect-col[data-stage="interesado"] .prospect-card[data-prospect="p1"]')).toBeVisible();
    await expect(page.locator('.prospect-col[data-stage="nuevo"] .prospect-card[data-prospect="p1"]')).toHaveCount(0);
    expect((await leer(page, "acl_local_prospectos")).find((p) => p.id === "p1").stage).toBe("interesado");

    // Soltarla en su misma columna no hace nada (ni siquiera una petición).
    const antes = (await leer(page, "acl_local_prospectos")).find((p) => p.id === "p1").updated_at;
    await page.locator('.prospect-card[data-prospect="p1"]').dragTo(page.locator('.prospect-col[data-stage="interesado"]'));
    expect((await leer(page, "acl_local_prospectos")).find((p) => p.id === "p1").updated_at).toBe(antes);
  });

  test("mandar a «Perdido» arrastrando pide confirmación", async ({ page, go }) => {
    await preparar(page, go);
    const mensajes = [];
    page.on("dialog", (d) => mensajes.push(d.message()));
    // En una laptop las seis columnas no caben: el tablero se desliza de lado. Se corre hasta el final para que «Perdido» esté a la
    // vista (arrastrando con el ratón, cerca del borde corre solo; aquí no se simula ese ir y venir).
    await page.locator(".prospect-board").evaluate((el) => (el.scrollLeft = el.scrollWidth));
    await page.locator('.prospect-card[data-prospect="p3"]').dragTo(page.locator('.prospect-col[data-stage="perdido"]'));
    await expect(page.locator('.prospect-col[data-stage="perdido"] .prospect-card[data-prospect="p3"]')).toBeVisible();
    expect(mensajes).toEqual(["¿Mandar a «Carla Arrastre QA» a Perdidos?"]); // la prueba acepta todos los avisos
    expect((await leer(page, "acl_local_prospectos")).find((p) => p.id === "p3").stage).toBe("perdido");
  });

  test("en modo «Seleccionar» las tarjetas no se arrastran", async ({ page, go, press }) => {
    await preparar(page, go);
    await press(page.getByRole("button", { name: "Seleccionar", exact: true }));
    await expect(page.locator('.prospect-card[data-prospect="p1"]')).toHaveAttribute("draggable", "false");
    await expect(page.locator(".prospect-drag-hint")).toHaveCount(0);
  });
});

test.describe("Vista dividida (pantalla ancha)", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("lista a la izquierda y ficha a la derecha: elegir cambia la ficha, se recuerda y «Ver tablero» regresa", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "en el teléfono no hay vista dividida (ver la prueba de abajo)");
    await preparar(page, go);
    await press(page.getByRole("button", { name: "Vista dividida" }));

    const lista = page.locator(".prospect-split__list");
    await expect(lista.locator(".prospect-row")).toHaveCount(3);
    // En el orden del tablero (de «Nuevo» a «Perdido»); el primero ya está elegido.
    await expect(lista.locator(".prospect-row").first()).toContainText("Ana Arrastre QA");
    await expect(lista.locator(".prospect-row").first()).toHaveAttribute("aria-pressed", "true");
    const detalle = page.locator(".prospect-split__detail");
    await expect(detalle).toContainText("Ana Arrastre QA");
    await expect(page.locator(".prospect-board")).toHaveCount(0);

    await press(lista.locator(".prospect-row", { hasText: "Carla Arrastre QA" }));
    await expect(detalle).toContainText("Carla Arrastre QA");
    await expect(detalle).not.toContainText("Ana Arrastre QA");
    await expect(detalle.getByRole("link", { name: "Abrir la ficha completa para editarla" })).toHaveAttribute("href", "/admin/prospectos/p3");
    await expect(page.locator('.prospect-timeline')).toBeVisible();

    // Los filtros siguen valiendo: la lista se acorta y la ficha pasa al primero que queda.
    await page.locator(".prospect-filters input[type=search]").fill("Beto"); // el buscador de la pantalla, no el de la barra de arriba
    await expect(lista.locator(".prospect-row")).toHaveCount(1);
    await expect(detalle).toContainText("Beto Arrastre QA");
    await page.locator(".prospect-filters input[type=search]").fill("");

    // Se recuerda al recargar; «Ver tablero» regresa a las columnas.
    await page.reload();
    await expect(page.locator(".prospect-split__list")).toBeVisible();
    await press(page.getByRole("button", { name: "Ver tablero" }));
    await expect(page.locator(".prospect-board")).toBeVisible();
    await expect(page.locator(".prospect-split")).toHaveCount(0);
  });

  test("cambiar la etapa en la ficha de la vista dividida actualiza la lista", async ({ page, go, press, isMobile }) => {
    test.skip(isMobile, "solo pantalla ancha");
    await preparar(page, go);
    await press(page.getByRole("button", { name: "Vista dividida" }));
    await press(page.locator(".prospect-split__list .prospect-row", { hasText: "Beto Arrastre QA" }));
    await expect(page.locator(".prospect-split__detail")).toContainText("Beto Arrastre QA");
    // El selector de etapa de la ficha (mismo cambio que en la ficha completa).
    await page.locator(".prospect-split__detail").getByLabel("Etapa").selectOption("negociacion");
    await expect(page.locator(".prospect-split__list .prospect-row", { hasText: "Beto Arrastre QA" })).toContainText("En negociación");
    expect((await leer(page, "acl_local_prospectos")).find((p) => p.id === "p2").stage).toBe("negociacion");
  });

  test("en el teléfono no hay vista dividida y las tarjetas no se arrastran", async ({ page, go, isMobile }) => {
    test.skip(!isMobile, "esta prueba es del teléfono");
    await preparar(page, go);
    await expect(page.getByRole("button", { name: "Vista dividida" })).toHaveCount(0);
    await expect(page.locator(".prospect-drag-hint")).toHaveCount(0);
    await expect(page.locator('.prospect-card[data-prospect="p1"]')).toHaveAttribute("draggable", "false");
  });
});
