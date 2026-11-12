import { test, expect } from "./fixtures.js";

// Flujos críticos de punta a punta, como los vive cada persona:
//  - el cliente en su portal (pendientes, subir un documento, ver el avance)
//    y el asesor del otro lado (pedir documentos, mover la etapa, aprobar);
//  - el asesor que abre el panel en «Mi día» y se mueve con la barra de abajo
//    en el teléfono;
//  - el seguimiento de un prospecto con la plantilla de su etapa, hasta
//    registrar el contacto.
// En modo demo todo vive en el localStorage de la prueba: el panel y el
// portal comparten navegador, así que el enlace del cliente se lee de ahí.

// PNG de 1×1 (foto de la INE de mentira): el portal acepta foto para la INE.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function crearCliente(page, go, press, { nombre, tipo = "comprador", financiamiento = "infonavit" }) {
  await go("/admin/clientes/nuevo");
  await page.fill("#c-name", nombre);
  await page.selectOption("#c-type", tipo);
  await page.fill("#c-phone", "8715550101");
  if (await page.locator("#c-financiamiento").count()) await page.selectOption("#c-financiamiento", financiamiento);
  await press(page.locator("form button[type=submit]").first());
  await page.waitForURL("**/admin/clientes");
  const id = await page.evaluate(
    (n) => JSON.parse(localStorage.getItem("acl_local_clients") || "[]").find((c) => c.name === n)?.id,
    nombre,
  );
  expect(id, "el cliente quedó guardado").toBeTruthy();
  return id;
}

// Lo menos frecuente de una tarjeta de prospecto (etapa, agendar, ficha, convertir,
// eliminar) está tras «Más»: se abre si no lo estaba.
async function abrirMas(tarjeta, press) {
  const mas = tarjeta.locator("details.prospect-more");
  if (!(await mas.evaluate((el) => el.open))) await press(mas.locator("summary"));
  await expect(mas).toHaveJSProperty("open", true);
}

// Captura WhatsApp en vez de abrir otra pestaña: guarda las URL que se abrirían.
async function capturarWhatsapp(page) {
  await page.evaluate(() => {
    window.__abiertas = [];
    window.open = (url) => {
      window.__abiertas.push(String(url));
      return null;
    };
  });
}

test.describe("Portal del cliente: pendientes, documentos y estatus del trámite", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("el asesor pide documentos y mueve la etapa; el cliente sube su INE y ve el avance", async ({ page, go, press }) => {
    test.setTimeout(90_000);
    const nombre = `Cliente Portal ${Date.now() % 100000}`;
    const clientId = await crearCliente(page, go, press, { nombre });

    await test.step("el asesor genera el enlace, elige documentos y etapa", async () => {
      await go(`/admin/clientes/${clientId}/documentos`);
      await press(page.getByRole("button", { name: "Generar enlace de documentos" }));
      await expect(page.getByRole("button", { name: "Copiar enlace" })).toBeVisible();

      const panel = page.locator(".admin-portal-tramite");
      await expect(panel).toContainText("0 de 4 listos");
      // A un comprador por omisión: INE, CURP, acta y constancia. Le agrega el estado de cuenta.
      await press(panel.getByLabel("Cuenta bancaria"));
      await expect(panel).toContainText("0 de 5 listos");
      await panel.locator("#tramite-stage").selectOption("avaluo");
      await panel.locator("#tramite-note").fill("El avalúo quedó para el jueves a las 10.");
      await press(panel.getByRole("button", { name: "Guardar" }));
      await expect(panel.getByRole("status")).toContainText("Guardado");

      // El mensaje de WhatsApp nombra los documentos pedidos.
      const whatsapp = await page.getByRole("link", { name: "Compartir por WhatsApp" }).getAttribute("href");
      expect(decodeURIComponent(whatsapp)).toContain("Cuenta bancaria");
    });

    const token = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem("acl_local_client_portal_tokens") || "[]").find((t) => t.client_id === id)?.token,
      clientId,
    );
    expect(token, "se generó el enlace del portal").toMatch(/^[0-9a-f]{32}$/);

    await test.step("el cliente acepta el aviso y ve su trámite y sus pendientes", async () => {
      await go(`/documentos/${token}`);
      await press(page.locator(".portal-consent__checkbox input"));
      await press(page.getByRole("button", { name: "Aceptar y continuar" }));

      const tramite = page.locator(".portal-tramite");
      await expect(tramite).toContainText("Paso 3 de 6"); // compra con crédito: documentos, revisión, avalúo…
      await expect(tramite.locator("[aria-current=step]")).toContainText("Avalúo");
      await expect(tramite).toContainText("El avalúo quedó para el jueves a las 10.");

      const pendientes = page.locator(".portal-checklist");
      await expect(pendientes).toContainText("0 de 5 listos");
      await expect(pendientes).toContainText("Te faltan 5 documentos por enviar.");
      await expect(page.locator(".portal-doc-card")).toHaveCount(5);
    });

    await test.step("sube una foto de su INE y queda en revisión", async () => {
      const tarjeta = page.locator("#portal-doc-ine");
      await tarjeta.locator("input[type=file]").first().setInputFiles({ name: "ine.png", mimeType: "image/png", buffer: PNG_1X1 });
      await expect(tarjeta.locator(".portal-badge")).toHaveText("En revisión");
      await expect(page.locator(".portal-checklist")).toContainText("Te faltan 4 documentos por enviar.");
      // La INE pide el reverso como segunda foto.
      await expect(page.locator("#portal-doc-ine")).toContainText("Subir reverso");
    });

    await test.step("el asesor la aprueba", async () => {
      await go(`/admin/clientes/${clientId}/documentos`);
      const tarjetaIne = page.locator(".admin-doc-card").filter({ has: page.locator("h3", { hasText: /^INE$/ }) });
      await expect(tarjetaIne).toContainText("Subido por el cliente");
      await press(tarjetaIne.getByRole("button", { name: "Aprobar" }));
      await expect(tarjetaIne.locator(".portal-badge").first()).toHaveText("Válido");
      await expect(page.locator(".admin-portal-tramite")).toContainText("1 de 5 listos");
    });

    await test.step("el cliente ve su INE aprobada y el avance", async () => {
      await go(`/documentos/${token}`);
      await expect(page.locator("#portal-doc-ine .portal-badge")).toHaveText("Aprobado");
      await expect(page.locator(".portal-checklist")).toContainText("1 de 5 listos");
      // Lo que falta va arriba; lo aprobado, al final.
      await expect(page.locator(".portal-doc-card").last()).toHaveAttribute("id", "portal-doc-ine");
    });
  });

  test("un enlace desactivado ya no muestra nada del cliente", async ({ page, go, press }) => {
    const clientId = await crearCliente(page, go, press, { nombre: `Cliente Revocado ${Date.now() % 100000}` });
    await go(`/admin/clientes/${clientId}/documentos`);
    await press(page.getByRole("button", { name: "Generar enlace de documentos" }));
    const token = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem("acl_local_client_portal_tokens") || "[]").find((t) => t.client_id === id)?.token,
      clientId,
    );
    await press(page.getByRole("button", { name: "Desactivar enlace" }));
    await expect(page.getByRole("button", { name: "Generar enlace de documentos" })).toBeVisible();

    await go(`/documentos/${token}`);
    await expect(page.locator("main")).toContainText("Enlace desactivado");
    await expect(page.locator(".portal-checklist, .portal-tramite")).toHaveCount(0);
  });
});

test.describe("Mi día como inicio y barra de abajo en el teléfono", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("elegir Mi día como inicio: /admin abre Mi día y el Panel sigue a la mano", async ({ page, go, press, isMobile }) => {
    // La oficina (sin asesor ligado, como el login demo) arranca en el Panel principal.
    await go("/admin");
    await expect(page).toHaveURL(/\/admin$/);

    await go("/admin/mi-dia");
    const casilla = page.getByLabel(/Abrir el panel en Mi día/);
    await expect(casilla).not.toBeChecked();
    await press(casilla);
    await expect(casilla).toBeChecked();

    await go("/admin");
    await page.waitForURL("**/admin/mi-dia");
    await expect(page.locator(".admin-layout__content h1").first()).toHaveText("Mi día");

    // En el menú, Mi día va primero y el Panel principal se movió a /admin/panel.
    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    const enlaces = page.locator(".admin-layout__sidebar nav > a");
    await expect(enlaces.first()).toHaveAttribute("href", "/admin/mi-dia");
    await press(page.locator('.admin-layout__sidebar a[href="/admin/panel"]'));
    await page.waitForURL("**/admin/panel");
    await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();

    // Y se puede regresar al inicio de siempre.
    await go("/admin/mi-dia");
    await press(page.getByLabel(/Abrir el panel en Mi día/));
    await go("/admin");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("teléfono: la barra de abajo lleva a lo del día y «Más» abre el menú completo", async ({ page, go, press, isMobile }) => {
    const barra = page.locator(".admin-tabbar");
    await go("/admin/mi-dia");
    if (!isMobile) {
      await expect(barra, "en PC no hay barra de abajo: el menú lateral está a la vista").toBeHidden();
      return;
    }

    await expect(barra).toBeVisible();
    // Con el login demo (oficina) el inicio es el Panel: Inicio, Prospectos, Agenda, Clientes y «Más».
    await expect(barra.locator("a")).toHaveCount(4);
    await expect(barra.getByRole("link", { name: /Prospectos/ })).toBeVisible();

    await press(barra.getByRole("link", { name: /Agenda/ }));
    await page.waitForURL("**/admin/agenda");
    await expect(barra.getByRole("link", { name: /Agenda/ })).toHaveClass(/active/);

    // El botón + de captura rápida no queda tapado por la barra.
    const fab = await page.getByRole("button", { name: /Prospecto rápido/ }).boundingBox();
    const caja = await barra.boundingBox();
    expect(fab.y + fab.height, "el botón + queda encima de la barra").toBeLessThanOrEqual(caja.y + 1);

    await press(barra.getByRole("button", { name: /Más/ }));
    await expect(page.locator(".admin-layout__backdrop")).toBeVisible();
    await expect(page.locator(".admin-layout__sidebar")).toHaveClass(/is-open/);
    await press(page.locator('.admin-layout__sidebar a[href="/admin/mi-dia"]'));
    await page.waitForURL("**/admin/mi-dia");
    await expect(page.locator(".admin-layout__backdrop")).toHaveCount(0);

    // Nada de la página queda escondido detrás de la barra al llegar al final.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const ultimo = await page.locator(".admin-layout__content > *").last().boundingBox();
    const barraAbajo = await barra.boundingBox();
    expect(ultimo.y + ultimo.height, "el final del contenido queda arriba de la barra").toBeLessThanOrEqual(barraAbajo.y + 1);
  });
});

test.describe("Seguimiento de un prospecto con la plantilla de su etapa", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("captura → cambiar etapa → mandar la plantilla sugerida → registrar el contacto", async ({ page, go, press }) => {
    test.setTimeout(60_000);
    const nombre = `Prospecto Etapa ${Date.now() % 100000}`;

    await test.step("captura rápida", async () => {
      await go("/admin/prospectos");
      await press(page.getByRole("button", { name: /Prospecto rápido/ }));
      const panel = page.locator(".quick-capture__sheet");
      await panel.locator("#qc-name").fill(nombre);
      await panel.locator("#qc-phone").fill("8715550202");
      await press(panel.locator("button[type=submit]"));
      await expect(page.locator(".quick-capture__done")).toBeVisible();
      await go("/admin/prospectos");
    });

    const tarjeta = page.locator(".prospect-card", { hasText: nombre });
    const mensaje = tarjeta.locator("select.quick-reply-select");

    await test.step("en «Nuevo» sugiere el primer contacto", async () => {
      await expect(mensaje.locator("optgroup").first()).toHaveAttribute("label", "Sugeridas para «Nuevo»");
      await expect(mensaje.locator("optgroup").first().locator("option").first()).toHaveText("Primer contacto");
    });

    await test.step("al pasar a negociación cambian las sugeridas", async () => {
      await abrirMas(tarjeta, press);
      await tarjeta.getByLabel("Etapa").selectOption("negociacion");
      await expect(mensaje.locator("optgroup").first()).toHaveAttribute("label", "Sugeridas para «En negociación»");
      await expect(mensaje.locator("optgroup").first().locator("option")).toHaveText(["¿Cómo va la propuesta?", "Pedir documentos", "Ofrecer ayuda con el crédito"]);
    });

    await test.step("manda la plantilla por WhatsApp con el nombre y el texto de la etapa", async () => {
      await capturarWhatsapp(page);
      await mensaje.selectOption({ label: "Pedir documentos" });
      const abiertas = await page.evaluate(() => window.__abiertas);
      expect(abiertas).toHaveLength(1);
      expect(abiertas[0]).toContain("https://wa.me/528715550202?text=");
      const texto = decodeURIComponent(abiertas[0].split("text=")[1]);
      expect(texto).toMatch(/^Hola Prospecto, para avanzar/);
      expect(texto).toContain("INE, CURP, acta de nacimiento y constancia de situación fiscal");
    });

    await test.step("al regresar ofrece registrar el contacto y lo guarda", async () => {
      const formulario = tarjeta.locator("form.contact-form");
      await expect(formulario).toBeVisible();
      // El canal ya viene elegido (acaba de mandar el WhatsApp); falta cuándo es el siguiente seguimiento.
      await expect(formulario.getByRole("radio", { name: "WhatsApp" })).toBeChecked();
      await press(formulario.getByRole("button", { name: "En 3 días" }));
      await press(formulario.locator("button[type=submit]"));
      await expect(formulario).toHaveCount(0);
      const guardado = await page.evaluate(
        (n) => JSON.parse(localStorage.getItem("acl_local_prospectos") || "[]").find((p) => p.name === n),
        nombre,
      );
      expect(guardado.stage).toBe("negociacion");
      expect(guardado.last_contact_at, "quedó registrado el contacto").toBeTruthy();
      expect(guardado.next_followup_at, "con su siguiente seguimiento").toBeTruthy();
    });

    await test.step("ya cerrado, sugiere felicitar, pedir recomendación y reseña", async () => {
      await abrirMas(tarjeta, press);
      await tarjeta.getByLabel("Etapa").selectOption("cerrado");
      await expect(mensaje.locator("optgroup")).toHaveCount(1);
      await expect(mensaje.locator("option:not([disabled])")).toHaveText(["Felicitar por la compra", "Pedir una recomendación", "Pedir una reseña"]);
    });
  });
});
