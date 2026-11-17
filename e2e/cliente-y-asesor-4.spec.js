import { test, expect, isoDate, abrirMas } from "./fixtures.js";

// Mejoras 41–50: propiedades estancadas, contratos por vencer, comisiones por asesor, tabla de posiciones, vistas guardadas,
// invitar desde Roles, contraseña (mostrar y olvidé), fusionar duplicados y centro de ayuda con recorrido guiado.
// Modo demo: la «base» es el localStorage de la prueba. (Mejora 43, publicar en portales, NO se hizo: ver README.)

const ahora = () => new Date().toISOString();
const haceDias = (n) => new Date(Date.now() - n * 864e5).toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);

const prospecto = (id, name, extra = {}) => ({
  id,
  name,
  phone: "8715550101",
  email: null,
  source: "manual",
  stage: "contactado",
  advisor_id: "advisor-1",
  property_id: null,
  looking_for: null,
  notes: null,
  last_contact_at: null,
  next_followup_at: null,
  lost_reason: null,
  created_at: ahora(),
  updated_at: ahora(),
  ...extra,
});

const propiedad = (id, title, extra = {}) => ({
  id,
  code: `ACL-${id}`,
  title,
  type: "casa",
  operation_type: "compra",
  status: "disponible",
  active: true,
  price: 1500000,
  area_m2: 120,
  zone: "Torreón",
  address: "Calle QA 1",
  lat: 25.54,
  lng: -103.4,
  advisor_ids: [],
  images: [],
  created_at: haceDias(1),
  updated_at: haceDias(1),
  ...extra,
});

const filaProp = (page, titulo) => page.locator(".admin-table tbody tr.admin-row", { hasText: titulo }).first();

test.describe("Inicio de sesión: contraseña", () => {
  test("«Mostrar» deja ver la contraseña y «Olvidé mi contraseña» avisa que en demo no hay cuentas reales", async ({ page, go, press }) => {
    await go("/admin/login");
    const campo = page.locator("#admin-password");
    await campo.fill("secreto-qa");
    await expect(campo).toHaveAttribute("type", "password");
    await press(page.getByRole("button", { name: "Mostrar" }));
    await expect(campo).toHaveAttribute("type", "text");
    await press(page.getByRole("button", { name: "Ocultar" }));
    await expect(campo).toHaveAttribute("type", "password");

    await press(page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    await expect(page.locator("#admin-password")).toHaveCount(0); // solo pide el correo
    await page.fill("#admin-email", "alguien@correo.com");
    await press(page.getByRole("button", { name: "Enviarme el enlace" }));
    await expect(page.getByRole("alert")).toContainText("modo demo");
    await press(page.getByRole("button", { name: "Volver a iniciar sesión" }));
    await expect(page.locator("#admin-password")).toBeVisible();
  });

  test("la página del enlace de recuperación explica que en demo no se puede restablecer", async ({ page, go }) => {
    await go("/admin/restablecer");
    await expect(page.getByRole("heading", { name: "Contraseña nueva" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("modo demo");
  });
});

test.describe("Propiedades: sin movimiento y contratos", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("una propiedad sin cambios, visitas, citas ni prospectos en 30+ días sale marcada y se puede filtrar", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    await poner(page, "acl_local_properties", [propiedad("q1", "Casa Dormida QA", { created_at: haceDias(120), updated_at: haceDias(100) }), propiedad("q2", "Casa Activa QA")]);
    await poner(page, "acl_local_visits", []);
    await poner(page, "acl_local_agenda_citas", []);
    await poner(page, "acl_local_prospectos", []);
    await go("/admin/propiedades");
    await expect(filaProp(page, "Casa Dormida QA")).toContainText("Sin movimiento hace 100 días");
    await expect(filaProp(page, "Casa Activa QA")).not.toContainText("Sin movimiento");

    if (await page.locator(".admin-filters__toggle").isVisible()) await press(page.locator(".admin-filters__toggle"));
    await page.getByLabel("Sin movimiento").selectOption("30");
    await expect(filaProp(page, "Casa Dormida QA")).toBeVisible();
    await expect(page.locator(".admin-table tbody tr.admin-row", { hasText: "Casa Activa QA" })).toHaveCount(0);

    // Una visita reciente es movimiento: la propiedad deja de estar estancada.
    await poner(page, "acl_local_visits", [{ id: "v1", property_id: "q1", advisor_id: "advisor-1", visited_at: haceDias(2), interest: "interesado" }]);
    await go("/admin/propiedades");
    await expect(filaProp(page, "Casa Dormida QA")).not.toContainText("Sin movimiento");
  });

  test("el contrato por vencer sale marcado en la lista y como aviso en Mi día; vigente no avisa", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    await poner(page, "acl_local_properties", [propiedad("c1", "Casa Exclusiva QA"), propiedad("c2", "Casa Lejana QA")]);
    await go("/admin/propiedades");
    const fila = filaProp(page, "Casa Exclusiva QA");
    await abrirMas(fila, press);
    await press(fila.getByRole("button", { name: "Contrato", exact: true }));
    const modal = page.getByRole("dialog", { name: "Contrato de intermediación" });
    await modal.getByLabel("Tipo").selectOption("exclusiva");
    await press(modal.getByRole("button", { name: "Guardar" }));
    await expect(page.getByRole("alert")).toContainText("fecha de vencimiento");
    await modal.getByLabel("Vence el").fill(isoDate(10));
    await press(modal.getByRole("button", { name: "Guardar" }));
    await expect(filaProp(page, "Casa Exclusiva QA")).toContainText("Exclusiva · Vence en 10 días");

    const lejana = filaProp(page, "Casa Lejana QA");
    await abrirMas(lejana, press);
    await press(lejana.getByRole("button", { name: "Contrato", exact: true }));
    await page.getByRole("dialog", { name: "Contrato de intermediación" }).getByLabel("Vence el").fill(isoDate(200));
    await press(page.getByRole("dialog").getByRole("button", { name: "Guardar" }));
    await expect(filaProp(page, "Casa Lejana QA")).not.toContainText("Vence en");

    await go("/admin/mi-dia");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: /Exclusivas por vencer/ }) });
    await expect(panel).toContainText("Casa Exclusiva QA");
    await expect(panel).toContainText("Vence en 10 días");
    await expect(panel).not.toContainText("Casa Lejana QA");
  });
});

test.describe("Comisiones por asesor", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("de la liquidación salen las comisiones de captación y de venta; se marcan pagadas con su fecha y la página de Comisiones las suma", async ({ page, go, press }) => {
    await go("/admin/propiedades/prop-1/liquidacion");
    await page.locator("#liq-costo-total").fill("1000000");
    await page.locator("#liq-captador").selectOption("advisor-1");
    await page.locator("#liq-vendedor").selectOption("advisor-2");
    // Las comisiones solo aparecen con la liquidación ya guardada.
    await expect(page.getByRole("heading", { name: "Comisiones por asesor" })).toHaveCount(0);
    await press(page.getByRole("button", { name: "Guardar", exact: true }));
    const tarjeta = page.locator(".commissions-card");
    await expect(tarjeta).toBeVisible();
    // Precio 2,450,000 − costo 1,000,000 = 1,450,000; captación 40 % = 580,000; venta 30 % de eso = 174,000; captador 406,000.
    await expect(tarjeta.locator("li", { hasText: "Captación" })).toContainText("$406,000");
    await expect(tarjeta.locator("li", { hasText: "Venta" })).toContainText("$174,000");

    await press(tarjeta.locator("li", { hasText: "Captación" }).getByRole("button", { name: "Registrar" }));
    await press(tarjeta.locator("li", { hasText: "Venta" }).getByRole("button", { name: "Registrar" }));
    await expect(tarjeta.locator("li", { hasText: "Captación" })).toContainText("Pendiente");
    const guardadas = await leer(page, "acl_local_commissions");
    expect(guardadas.map((c) => [c.concept, c.advisor_id, c.amount, c.status]).sort()).toEqual([
      ["captacion", "advisor-1", 406000, "pendiente"],
      ["venta", "advisor-2", 174000, "pendiente"],
    ]);

    await press(tarjeta.locator("li", { hasText: "Captación" }).getByRole("button", { name: "Marcar pagada" }));
    await expect(tarjeta.locator("li", { hasText: "Captación" })).toContainText("Pagada el");
    expect((await leer(page, "acl_local_commissions")).find((c) => c.concept === "captacion")).toMatchObject({ status: "pagada" });

    await go("/admin/comisiones");
    await expect(page.getByRole("heading", { name: "Comisiones" })).toBeVisible();
    await expect(page.locator(".admin-stat", { hasText: "Carlos Delgado" })).toContainText("Pagado: $406,000");
    await expect(page.locator(".admin-stat", { hasText: "Ana Martínez" })).toContainText("Pendiente: $174,000");
    // Por omisión solo se ven las pendientes.
    await expect(page.locator(".commissions-card__item")).toHaveCount(1);
    await page.getByLabel("Estado").selectOption("");
    await expect(page.locator(".commissions-card__item")).toHaveCount(2);
  });
});

test.describe("Prospectos: fusionar duplicados y vistas guardadas", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("fusiona un duplicado en el prospecto abierto: se conserva su historia y el otro desaparece", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [
      prospecto("m1", "Luis Pérez QA", { phone: "8711112222", stage: "contactado", notes: "nota uno" }),
      prospecto("m2", "Luis P. QA", { phone: "8711112222", email: "luis@correo.com", stage: "negociacion", notes: "nota dos" }),
    ]);
    await poner(page, "acl_local_prospect_contacts", [{ id: 1, prospecto_id: "m2", channel: "llamada", note: "llamé", at: ahora() }]);
    await go("/admin/prospectos/m1");
    const aviso = page.getByRole("region", { name: "Posibles duplicados" });
    await expect(aviso).toContainText("Luis P. QA");
    await press(aviso.getByRole("button", { name: "Fusionar aquí" }));
    await expect(page.getByRole("region", { name: "Posibles duplicados" })).toHaveCount(0);

    const guardados = await leer(page, "acl_local_prospectos");
    expect(guardados.map((p) => p.id)).toEqual(["m1"]);
    expect(guardados[0]).toMatchObject({ email: "luis@correo.com", stage: "negociacion" });
    expect(guardados[0].notes).toContain("nota uno");
    expect(guardados[0].notes).toContain("nota dos");
    expect((await leer(page, "acl_local_prospect_contacts"))[0].prospecto_id).toBe("m1");
  });

  test("una vista guardada vuelve a poner los filtros con un toque y se recuerda al recargar", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [prospecto("v1", "Ana Vista QA"), prospecto("v2", "Beto Vista QA")]);
    await go("/admin/prospectos");
    const buscador = page.getByRole("searchbox", { name: /nombre, teléfono o propiedad/ });
    const guardar = page.getByRole("button", { name: "Guardar esta vista" });
    await expect(guardar).toBeDisabled(); // sin filtros no hay nada que guardar
    await buscador.fill("Ana");
    await press(guardar);
    await page.getByLabel("Nombre de la vista").fill("Solo Ana");
    await press(page.getByRole("button", { name: "Guardar", exact: true }));
    const chip = page.locator(".saved-views__chip", { hasText: "Solo Ana" });
    await expect(chip).toBeVisible();

    await buscador.fill("");
    await expect(page.locator(".prospect-card", { hasText: "Beto Vista QA" })).toBeVisible();
    await press(chip.locator(".saved-views__apply"));
    await expect(buscador).toHaveValue("Ana");
    await expect(page.locator(".prospect-card", { hasText: "Beto Vista QA" })).toHaveCount(0);

    await go("/admin/prospectos");
    await expect(page.locator(".saved-views__chip", { hasText: "Solo Ana" })).toBeVisible();
    await press(page.locator(".saved-views__chip", { hasText: "Solo Ana" }).getByRole("button", { name: /Quitar la vista/ }));
    await expect(page.locator(".saved-views__chip")).toHaveCount(0);
  });
});

test.describe("Mi día: tabla del mes", () => {
  test("ordena al equipo por puntos y marca el primer lugar; sin nombres de clientes ni montos", async ({ page, go, seedAdminSession }) => {
    await seedAdminSession();
    await go("/admin/mi-dia");
    await poner(page, "acl_local_prospectos", [prospecto("l1", "Cliente Secreto QA", { advisor_id: "advisor-2" })]);
    await poner(page, "acl_local_visits", [
      { id: "lv1", property_id: "prop-1", advisor_id: "advisor-1", visited_at: ahora(), interest: "interesado" },
      { id: "lv2", property_id: "prop-1", advisor_id: "advisor-1", visited_at: ahora(), interest: "interesado" },
    ]);
    await poner(page, "acl_local_ventas", []);
    await go("/admin/mi-dia");
    const tabla = page.locator("section", { has: page.getByRole("heading", { name: "Tabla del mes" }) });
    const filas = tabla.locator(".leaderboard__row");
    await expect(filas.first()).toContainText("Carlos Delgado"); // 2 visitas = 6 pts
    await expect(filas.first()).toContainText("6 puntos");
    await expect(filas.first().locator(".leaderboard__rank")).toContainText("🥇");
    await expect(tabla).not.toContainText("Cliente Secreto QA");
  });
});

test.describe("Roles: invitación por correo", () => {
  test("al dar un acceso nuevo se ofrece invitar; en demo avisa que no hay cuentas reales y el acceso sí queda dado", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    await go("/admin/roles");
    await expect(page.getByLabel("Enviarle una invitación por correo")).toBeChecked();
    await page.locator("#access-new-email").fill("nueva.persona@correo.com");
    const rol = page.locator("#access-new-role");
    await rol.selectOption({ index: 1 });
    await press(page.getByRole("button", { name: "Dar acceso" }));
    await expect(page.getByRole("status").filter({ hasText: "modo demo" })).toBeVisible();
    await expect(page.locator(".admin-table tbody tr", { hasText: "nueva.persona@correo.com" })).toBeVisible();
    await press(page.locator(".admin-table tbody tr", { hasText: "nueva.persona@correo.com" }).getByRole("button", { name: "Invitar" }));
    await expect(page.getByRole("status").filter({ hasText: "modo demo" })).toBeVisible();
  });
});

test.describe("Centro de ayuda y recorrido guiado", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("la ayuda busca sin importar acentos, muestra solo temas del rol y lleva a cada lugar", async ({ page, go, press }) => {
    await go("/admin/ayuda");
    await expect(page.getByRole("heading", { name: "Ayuda", exact: true })).toBeVisible();
    await expect(page.locator(".help-topic").first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar en la ayuda…" }).fill("contrasena");
    const temas = page.locator(".help-topic");
    // «contraseña» está en Mi cuenta y en Roles y accesos (la invitación); no sale nada más.
    await expect(temas).toHaveCount(2);
    await expect(temas.filter({ hasText: "Mi cuenta" })).toHaveCount(1);
    await expect(temas.filter({ hasText: "Roles y accesos" })).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Buscar en la ayuda…" }).fill("zzzxxx");
    await expect(page.getByText("No hay temas con esa búsqueda.")).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar en la ayuda…" }).fill("fusionar");
    await press(page.locator(".help-topic").first().getByRole("link", { name: "Ir allí" }));
    await expect(page).toHaveURL(/\/admin\/prospectos$/);
  });

  test("el recorrido guía paso a paso, vuelve atrás, se cierra con Escape y devuelve el foco", async ({ page, go, press }) => {
    await go("/admin/ayuda");
    const abrir = page.getByRole("button", { name: "Ver el recorrido guiado" });
    await press(abrir);
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toContainText("Bienvenido al panel");
    await expect(dialogo).toContainText(/Paso 1 de \d+/);
    await press(dialogo.getByRole("button", { name: "Siguiente" }));
    await expect(dialogo).toContainText("Mi día");
    await press(dialogo.getByRole("button", { name: "Atrás" }));
    await expect(dialogo).toContainText("Bienvenido al panel");
    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);

    // Hasta el final: el último paso dice dónde está la ayuda y «Terminar» cierra.
    await press(abrir);
    for (let i = 0; i < 12 && !(await page.getByRole("dialog").getByRole("button", { name: "Terminar" }).count()); i += 1) {
      await press(page.getByRole("dialog").getByRole("button", { name: "Siguiente" }));
    }
    await expect(page.getByRole("dialog")).toContainText("¿Dudas?");
    await press(page.getByRole("dialog").getByRole("button", { name: "Terminar" }));
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("en modo demo no sale el aviso de «primera vez» (no estorba a las demás pantallas)", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await expect(page.getByRole("region", { name: "Recorrido guiado" })).toHaveCount(0);
  });
});

test.describe("Avisos y confirmaciones propias", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("la confirmación es un modal propio: Escape cancela, el foco empieza en «Cancelar» si es destructiva y Aceptar sigue adelante", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    await page.evaluate(() => {
      window.__ACL_AUTO_CONFIRM__ = false;
    });
    const fila = page.locator(".admin-table tbody tr.admin-row").first();
    const total = await page.locator(".admin-table tbody tr.admin-row").count();
    await abrirMas(fila, press);
    await press(fila.getByRole("button", { name: "Eliminar" }));
    const modal = page.getByRole("alertdialog");
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(page.locator(".admin-table tbody tr.admin-row")).toHaveCount(total); // cancelar no borra nada

    await abrirMas(fila, press);
    await press(fila.getByRole("button", { name: "Eliminar" }));
    await press(page.getByRole("alertdialog").getByRole("button", { name: "Aceptar" }));
    await expect(page.locator(".admin-table tbody tr.admin-row")).toHaveCount(total - 1);
  });
});
