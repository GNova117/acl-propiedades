import { test, expect } from "./fixtures.js";

// Selección de propiedades en un solo enlace: el asesor arma una selección (desde la ficha del prospecto, con las que le
// encajan ya marcadas, o desde Propiedades), manda UN enlace público (/seleccion/<token>) y ve en la ficha cuándo lo abrió
// el cliente. Modo demo: la «base» es el localStorage de la prueba; la página pública se abre en la misma pestaña.

const ahora = () => new Date().toISOString();
const SELECCIONES = "acl_local_selecciones";

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

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

test.describe("Selección de propiedades", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("desde la ficha: se arma con las que le encajan, se manda por WhatsApp y se ve cuando el cliente la abre", async ({ page, go, press }) => {
    const p = prospecto("sel1", "Selección QA", { search_criteria: { type: "casa" } });
    await go("/admin/prospectos");
    await poner(page, "acl_local_prospectos", [p]);
    await go(`/admin/prospectos/${p.id}`);
    const lista = page.getByRole("region", { name: "Selecciones enviadas" });
    await expect(lista).toContainText("Todavía no le has mandado una selección.");

    await press(lista.getByRole("button", { name: "Armar selección" }));
    const dialogo = page.getByRole("dialog", { name: "Armar selección" });
    await expect(dialogo).toContainText("Para Selección QA. Las propiedades que le encajan ya vienen marcadas.");

    await test.step("las coincidencias vienen marcadas y se puede agregar otra", async () => {
      await expect(dialogo.getByRole("checkbox", { name: "Elegir Casa en Residencial Senderos" })).toBeChecked();
      await expect(dialogo.getByRole("checkbox", { name: "Elegir Casa en Las Fuentes" })).toBeChecked();
      await expect(dialogo.getByRole("checkbox", { name: "Elegir Departamento en Centro de Torreón" })).not.toBeChecked();
      await expect(dialogo.getByText("2 de 12 propiedades elegidas", { exact: true })).toBeVisible();
      await dialogo.getByRole("searchbox", { name: "Buscar propiedad por nombre, código o zona" }).fill("Nave Industrial en Lerdo");
      await dialogo.getByRole("checkbox", { name: "Elegir Nave Industrial en Lerdo" }).check();
      await expect(dialogo.getByText("3 de 12 propiedades elegidas", { exact: true })).toBeVisible();
      // la apartada y la vendida no se ofrecen: no se le manda algo que ya no se puede comprar
      await dialogo.getByRole("searchbox", { name: "Buscar propiedad por nombre, código o zona" }).fill("Casa en Los Fresnos");
      await expect(dialogo.getByRole("checkbox", { name: "Elegir Casa en Los Fresnos" })).toHaveCount(0);
      await dialogo.getByRole("searchbox", { name: "Buscar propiedad por nombre, código o zona" }).fill("");
      await dialogo.getByRole("textbox", { name: "Mensaje para el cliente (opcional)" }).fill("Estas son las que mejor van con lo que platicamos.");
    });

    let token;
    await test.step("crea el enlace: queda guardado y el mensaje ya trae la dirección", async () => {
      await press(dialogo.getByRole("button", { name: "Crear enlace con 3 propiedades" }));
      await expect(dialogo.getByRole("heading", { name: "Enlace listo" })).toBeVisible();
      const url = await dialogo.locator("#selection-url").inputValue();
      token = url.split("/seleccion/")[1];
      expect(token).toMatch(/^[0-9a-f]{32}$/);

      const [guardada] = await leer(page, SELECCIONES);
      expect(guardada).toMatchObject({ prospecto_id: "sel1", title: "Propiedades para Selección", note: "Estas son las que mejor van con lo que platicamos.", open_count: 0, token });
      expect(guardada.property_ids).toHaveLength(3);

      const wa = await dialogo.getByRole("link", { name: "Abrir WhatsApp" }).getAttribute("href");
      expect(wa).toMatch(/^https:\/\/wa\.me\/528715550101\?text=/);
      const texto = decodeURIComponent(wa.split("?text=")[1]);
      expect(texto).toContain("Hola Selección,");
      expect(texto).toContain("3 propiedades");
      expect(texto).toContain(url);
    });

    await test.step("al mandarla por WhatsApp se ofrece registrar el contacto", async () => {
      const [popup] = await Promise.all([page.waitForEvent("popup"), press(dialogo.getByRole("link", { name: "Abrir WhatsApp" }))]);
      await popup.close();
      await expect(page.getByRole("dialog", { name: "Armar selección" })).toHaveCount(0);
      await expect(page.locator(".prospect-profile form.contact-form")).toBeVisible();
      await press(page.locator(".prospect-profile form.contact-form").getByRole("button", { name: "Cancelar" }));
    });

    await test.step("la ficha la lista como «Sin abrir», con lo que se puede hacer con ella", async () => {
      await expect(lista.locator("li")).toHaveCount(1);
      await expect(lista).toContainText("Propiedades para Selección");
      await expect(lista).toContainText("3 propiedades");
      await expect(lista.locator("li").first()).toContainText("Sin abrir");
      await expect(lista.getByRole("button", { name: "Copiar enlace" })).toBeVisible();
      await expect(lista.getByRole("link", { name: "Reenviar" })).toHaveAttribute("href", /^https:\/\/wa\.me\/528715550101\?text=/);
    });

    await test.step("el asesor la previsualiza como cliente: se ve igual, avisa que es vista previa y NO cuenta", async () => {
      await go(`/seleccion/${token}?vista=asesor`);
      await expect(page.locator(".public-selection__preview")).toContainText("Vista previa del asesor");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Propiedades para Selección");
      expect((await leer(page, SELECCIONES))[0].open_count).toBe(0);
    });

    await test.step("el cliente la abre: título, mensaje, asesor y las 3 propiedades con «Me interesa»", async () => {
      await go(`/seleccion/${token}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Propiedades para Selección");
      await expect(page.getByText("Estas son las que mejor van con lo que platicamos.")).toBeVisible();
      await expect(page.locator(".property-card")).toHaveCount(3);
      await expect(page.locator(".public-selection__advisor")).toContainText("Carlos Delgado");
      await expect(page.locator(".public-selection__advisor").getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/528711234567\?text=/);
      const interesa = page.getByRole("link", { name: "Me interesa: Casa en Las Fuentes" });
      await expect(interesa).toHaveAttribute("href", /^https:\/\/wa\.me\/528711234567\?text=/);
      expect(decodeURIComponent((await interesa.getAttribute("href")).split("?text=")[1])).toContain("Casa en Las Fuentes");
      await expect(page.getByRole("link", { name: "Ver detalle" })).toHaveCount(3);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });

    await test.step("recargar no la cuenta otra vez (una apertura por pestaña)", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".property-card")).toHaveCount(3);
      const [guardada] = await leer(page, SELECCIONES);
      expect(guardada.open_count).toBe(1);
      expect(guardada.first_opened_at).toBeTruthy();
    });

    await test.step("el asesor lo ve: la ficha dice que la abrió, la línea de tiempo lo anota y la tarjeta lo destaca", async () => {
      await go(`/admin/prospectos/${p.id}`);
      await expect(lista.locator("li").first()).toContainText("La abrió");
      await expect(lista.locator("li").first()).toContainText("1 vez");
      const linea = page.getByRole("region", { name: "Línea de tiempo" });
      await expect(linea.locator('[data-kind="selectionOpened"]')).toContainText("Abrió «Propiedades para Selección»");
      await expect(linea.locator('[data-kind="selection"]')).toContainText("«Propiedades para Selección» · 3 propiedades");

      await go("/admin/prospectos");
      const tarjeta = page.locator(".prospect-card", { hasText: "Selección QA" });
      // el tablero abre en la primera etapa con prospectos; «contactado» ya es esa
      await expect(tarjeta).toContainText("Abrió la selección");
    });

    await test.step("al contactarlo después de que la abrió, la señal se apaga (ya se le dio seguimiento)", async () => {
      const [enBase] = await leer(page, "acl_local_prospectos");
      await poner(page, "acl_local_prospectos", [{ ...enBase, last_contact_at: new Date(Date.now() + 60_000).toISOString() }]);
      await go("/admin/prospectos");
      await expect(page.locator(".prospect-card", { hasText: "Selección QA" })).not.toContainText("Abrió la selección");
    });

    await test.step("desactivar el enlace: el cliente ya no puede abrirla", async () => {
      await go(`/admin/prospectos/${p.id}`);
      await press(lista.getByRole("button", { name: "Desactivar" })); // el aviso de confirmación se acepta solo
      await expect(lista.locator("li").first()).toContainText("Desactivada");
      await expect(lista.getByRole("button", { name: "Desactivar" })).toHaveCount(0);
      await go(`/seleccion/${token}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Esta selección ya no está disponible");
      await expect(page.locator(".property-card")).toHaveCount(0);
      await expect(page.locator(".public-selection__advisor")).toContainText("Carlos Delgado"); // para que le escriba
    });
  });

  test("la página pública: enlace que no existe, vencida y propiedades que ya no están a la venta", async ({ page, go }) => {
    await go("/seleccion/" + "0".repeat(32));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Enlace no válido");

    const base = { id: "s-x", title: "Para Ana", note: null, advisor_id: "advisor-2", prospecto_id: null, created_at: ahora(), first_opened_at: null, last_opened_at: null, open_count: 0, revoked_at: null };
    const dia = 864e5;
    await poner(page, SELECCIONES, [
      { ...base, id: "s-venc", token: "1".repeat(32), property_ids: ["prop-1"], expires_at: new Date(Date.now() - dia).toISOString() },
      { ...base, id: "s-mix", token: "2".repeat(32), property_ids: ["prop-6", "prop-1", "prop-no-existe"], expires_at: new Date(Date.now() + dia).toISOString() },
    ]);

    await go("/seleccion/" + "1".repeat(32));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Esta selección ya venció");
    await expect(page.locator(".public-selection__advisor")).toContainText("Ana Martínez");

    await go("/seleccion/" + "2".repeat(32));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Para Ana");
    await expect(page.locator(".property-card")).toHaveCount(2); // la que ya no existe simplemente no aparece
    const vendida = page.locator(".public-selection__item", { hasText: "Departamento en Lerdo Centro" });
    await expect(vendida).toContainText("Ya no está disponible");
    await expect(vendida.getByRole("link", { name: /Me interesa/ })).toHaveCount(0);
    await expect(page.locator(".public-selection__item", { hasText: "Casa en Residencial Senderos" }).getByRole("link", { name: /Me interesa/ })).toBeVisible();
    // vencida no cuenta aperturas; la vigente sí
    const guardadas = await leer(page, SELECCIONES);
    expect(guardadas.find((s) => s.id === "s-venc").open_count).toBe(0);
    expect(guardadas.find((s) => s.id === "s-mix").open_count).toBe(1);
  });

  test("desde Propiedades: se elige a quién (otro número), las propiedades, y sin conexión avisa en vez de perder lo elegido", async ({ page, go, press }) => {
    await go("/admin/propiedades");
    await press(page.getByRole("button", { name: "Armar selección" }));
    const dialogo = page.getByRole("dialog", { name: "Armar selección" });
    await expect(dialogo.getByRole("button", { name: /Crear enlace/ })).toBeDisabled(); // sin propiedades no se puede crear

    await press(dialogo.getByRole("radio", { name: "Otro número" }));
    await dialogo.getByLabel("Teléfono (10 dígitos)").fill("871 555 0909");
    await dialogo.getByRole("checkbox", { name: "Elegir Casa en Las Fuentes" }).check();
    await dialogo.getByRole("checkbox", { name: "Elegir Departamento en Valle del Guadiana" }).check();
    await expect(dialogo.getByRole("textbox", { name: "Título (lo ve el cliente)" })).toHaveValue("Propiedades para ti");

    await test.step("sin conexión no se puede crear el enlace y lo elegido se queda", async () => {
      await page.context().setOffline(true);
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
      await press(dialogo.getByRole("button", { name: "Crear enlace con 2 propiedades" }));
      await expect(dialogo.getByRole("alert")).toContainText("Necesitas conexión para crear el enlace.");
      await expect(dialogo.getByRole("checkbox", { name: "Elegir Casa en Las Fuentes" })).toBeChecked();
      await page.context().setOffline(false);
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    });

    await press(dialogo.getByRole("button", { name: "Crear enlace con 2 propiedades" }));
    await expect(dialogo.getByRole("heading", { name: "Enlace listo" })).toBeVisible();
    const wa = await dialogo.getByRole("link", { name: "Abrir WhatsApp" }).getAttribute("href");
    expect(wa).toMatch(/^https:\/\/wa\.me\/528715550909\?text=/);
    expect(decodeURIComponent(wa.split("?text=")[1])).toContain("Hola,");
    const [guardada] = await leer(page, SELECCIONES);
    expect(guardada).toMatchObject({ prospecto_id: null, advisor_id: null, title: "Propiedades para ti" });
    expect(guardada.property_ids).toHaveLength(2);

    await test.step("sin asesor, la página le da al cliente el WhatsApp de la oficina", async () => {
      await go(`/seleccion/${guardada.token}`);
      await expect(page.locator(".public-selection__advisor")).toContainText("ACL Propiedades");
      await expect(page.locator(".public-selection__advisor").getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/528713243271\?text=/);
      await expect(page.getByRole("link", { name: /Me interesa: Casa en Las Fuentes/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/528713243271\?text=/);
    });
  });
});
