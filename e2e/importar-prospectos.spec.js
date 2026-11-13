import { test, expect } from "./fixtures.js";

// Pegar o importar una lista de prospectos: texto de un chat de WhatsApp, CSV (Facebook Lead Ads, hoja de cálculo) o contactos
// .vcf. Se revisa lo que se entendió, se corrigen renglones, los que ya existen o se repiten vienen sin marcar, y se guardan
// como prospectos nuevos. Modo demo: la «base» es el localStorage de la prueba.

const ahora = () => new Date().toISOString();
const PROSPECTOS = "acl_local_prospectos";

const prospecto = (id, name, phone) => ({
  id,
  name,
  phone,
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
});
const cliente = (id, name, phone) => ({ id, name, type: "comprador", email: null, phone, notes: null, active: true, financiamiento: null, created_at: ahora(), updated_at: ahora() });

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);

const TEXTO = [
  "Luis Pérez 871 123 4567",
  "Ana López - 871 234 5678 - ana@correo.com",
  "Ya Existe 871 555 0101",
  "Cliente Existe +52 871 555 0202",
  "Luis P. +52 871 123 4567",
  "Sin Telefono 871 12",
  "Carlos Ruiz",
  "(871) 345-6789",
].join("\n");

test.describe("Pegar o importar prospectos", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("texto pegado: se revisa, los repetidos y los que ya existen vienen sin marcar, se corrige y se guarda", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await poner(page, PROSPECTOS, [prospecto("ya1", "Ya Existe QA", "8715550101")]);
    await poner(page, "acl_local_clients", [cliente("k1", "Cliente Existe QA", "871 555 0202")]);
    await go("/admin/prospectos");

    await press(page.getByRole("button", { name: "Pegar o importar lista" }));
    const dialogo = page.getByRole("dialog", { name: "Pegar o importar prospectos" });
    await expect(dialogo.getByRole("button", { name: "Revisar" })).toBeDisabled(); // sin texto no hay qué revisar
    await dialogo.getByRole("textbox", { name: "Texto o lista" }).fill(TEXTO);
    await press(dialogo.getByRole("button", { name: "Revisar" }));

    await expect(dialogo.getByText("Encontré 6 contactos (lista de texto).")).toBeVisible();
    const fila = (n) => dialogo.locator(`[data-row="${n}"]`);

    await test.step("lo que se entendió: nombre, teléfono normalizado y correo", async () => {
      await expect(fila(0).getByRole("textbox", { name: "Nombre" })).toHaveValue("Luis Pérez");
      await expect(fila(0).getByRole("textbox", { name: "Teléfono" })).toHaveValue("8711234567");
      await expect(fila(1).getByRole("textbox", { name: "Correo" })).toHaveValue("ana@correo.com");
      // «Carlos Ruiz» y su teléfono venían en dos renglones
      await expect(fila(5).getByRole("textbox", { name: "Nombre" })).toHaveValue("Carlos Ruiz");
      await expect(fila(5).getByRole("textbox", { name: "Teléfono" })).toHaveValue("8713456789");
    });

    await test.step("ya existe (prospecto o cliente) y repetido en la lista: sin marcar y con su aviso", async () => {
      await expect(dialogo.getByText("Revisando si ya existen…")).toHaveCount(0);
      await expect(fila(2)).toContainText("Ya existe: Ya Existe QA (prospecto)");
      await expect(fila(3)).toContainText("Ya existe: Cliente Existe QA (cliente)");
      await expect(fila(4)).toContainText("Repetido en la lista");
      for (const n of [2, 3, 4]) await expect(fila(n).getByRole("checkbox")).not.toBeChecked();
      for (const n of [0, 1, 5]) await expect(fila(n).getByRole("checkbox")).toBeChecked();
      await expect(dialogo.getByText("3 por importar · 3 sin importar")).toBeVisible();
    });

    await test.step("corregir el teléfono del repetido lo deja listo y se marca solo", async () => {
      await fila(4).getByRole("textbox", { name: "Teléfono" }).fill("871 999 0000");
      await expect(fila(4)).not.toContainText("Repetido en la lista");
      await expect(fila(4).getByRole("checkbox")).toBeChecked();
      await expect(dialogo.getByText("4 por importar · 2 sin importar")).toBeVisible();
    });

    await test.step("se asigna a un asesor y se guarda", async () => {
      await dialogo.getByLabel("Asignar a").selectOption({ label: "Ana Martínez" });
      await press(dialogo.getByRole("button", { name: "Importar 4 prospectos" }));
      await expect(dialogo.getByRole("status")).toHaveText("Se importaron 4 prospectos.");
      const guardados = await leer(page, PROSPECTOS);
      const nuevos = guardados.filter((p) => p.source === "importado");
      expect(nuevos.map((p) => p.name).sort()).toEqual(["Ana López", "Carlos Ruiz", "Luis P.", "Luis Pérez"]);
      for (const p of nuevos) expect(p).toMatchObject({ stage: "nuevo", advisor_id: "advisor-2", last_contact_at: null });
      expect(nuevos.find((p) => p.name === "Ana López")).toMatchObject({ phone: "8712345678", email: "ana@correo.com" });
      expect(nuevos.find((p) => p.name === "Luis P.").phone).toBe("8719990000");
      expect(guardados.filter((p) => p.source !== "importado")).toHaveLength(1); // el que ya existía no se duplicó
    });

    await test.step("al cerrar, el tablero ya los muestra", async () => {
      await press(dialogo.getByRole("button", { name: "Listo" }));
      await expect(dialogo).toHaveCount(0);
      await expect(page.locator(".prospect-card", { hasText: "Carlos Ruiz" }).first()).toBeVisible();
    });
  });

  test("un CSV de Facebook Lead Ads: se lee por encabezados y se importa lo marcado", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await press(page.getByRole("button", { name: "Pegar o importar lista" }));
    const dialogo = page.getByRole("dialog", { name: "Pegar o importar prospectos" });
    const csv = [
      "id,created_time,full_name,phone_number,email,city",
      "1,2026-11-10T10:00:00,Elena Torres,p:+528711112222,elena@x.com,Torreón",
      "2,2026-11-10T11:00:00,Mario Soto,p:+528713334444,,Gómez Palacio",
    ].join("\n");
    await dialogo.locator('input[type="file"]').setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    await expect(dialogo.getByText("Encontré 2 contactos (archivo CSV).")).toBeVisible();
    await expect(dialogo.locator('[data-row="0"]').getByRole("textbox", { name: "Nombre" })).toHaveValue("Elena Torres");
    await expect(dialogo.locator('[data-row="0"]').getByRole("textbox", { name: "Teléfono" })).toHaveValue("8711112222");

    await dialogo.locator('[data-row="1"]').getByRole("checkbox").uncheck(); // se deja uno fuera
    await press(dialogo.getByRole("button", { name: "Importar 1 prospecto" }));
    await expect(dialogo.getByRole("status")).toHaveText("Se importó 1 prospecto.");
    const guardados = (await leer(page, PROSPECTOS)).filter((p) => p.source === "importado");
    expect(guardados.map((p) => p.name)).toEqual(["Elena Torres"]);
    expect(guardados[0]).toMatchObject({ phone: "8711112222", email: "elena@x.com", advisor_id: null }); // sin asesor elegido
  });

  test("contactos compartidos (.vcf) y un texto sin nada utilizable", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await press(page.getByRole("button", { name: "Pegar o importar lista" }));
    const dialogo = page.getByRole("dialog", { name: "Pegar o importar prospectos" });

    await dialogo.getByRole("textbox", { name: "Texto o lista" }).fill("hola, buen día\nme interesa una casa");
    await press(dialogo.getByRole("button", { name: "Revisar" }));
    await expect(dialogo.getByRole("alert")).toHaveText("No encontré ningún teléfono ni correo en ese texto.");

    const vcf = ["BEGIN:VCARD", "VERSION:3.0", "FN:Rosa Medina", "TEL;type=CELL:+52 871 777 8888", "END:VCARD"].join("\r\n");
    await dialogo.locator('input[type="file"]').setInputFiles({ name: "contactos.vcf", mimeType: "text/vcard", buffer: Buffer.from(vcf) });
    await expect(dialogo.getByText("Encontré 1 contacto (contactos .vcf).")).toBeVisible();
    await expect(dialogo.locator('[data-row="0"]').getByRole("textbox", { name: "Nombre" })).toHaveValue("Rosa Medina");

    await press(dialogo.getByRole("button", { name: "Cambiar el texto" }));
    await expect(dialogo.getByRole("textbox", { name: "Texto o lista" })).toBeVisible();
  });

  test("un renglón mal (sin nombre o con el teléfono incompleto) no se puede marcar hasta corregirlo; sin conexión no se importa", async ({ page, go, press }) => {
    await go("/admin/prospectos");
    await press(page.getByRole("button", { name: "Pegar o importar lista" }));
    const dialogo = page.getByRole("dialog", { name: "Pegar o importar prospectos" });
    await dialogo.getByRole("textbox", { name: "Texto o lista" }).fill("8711234567\nPedro Gil a@x.com");
    await press(dialogo.getByRole("button", { name: "Revisar" }));
    const sinNombre = dialogo.locator('[data-row="0"]');
    await expect(sinNombre).toContainText("Falta el nombre");
    await expect(sinNombre.getByRole("checkbox")).toBeDisabled();
    await expect(dialogo.getByText("1 por importar · 1 sin importar")).toBeVisible();

    await sinNombre.getByRole("textbox", { name: "Nombre" }).fill("Juan Sin Nombre");
    await expect(sinNombre.getByRole("checkbox")).toBeChecked();

    await page.context().setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await press(dialogo.getByRole("button", { name: "Importar 2 prospectos" }));
    await expect(dialogo.getByRole("alert")).toHaveText("Necesitas conexión para importar.");
    expect((await leer(page, PROSPECTOS)).filter((p) => p.source === "importado")).toHaveLength(0);
    await page.context().setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await press(dialogo.getByRole("button", { name: "Importar 2 prospectos" }));
    await expect(dialogo.getByRole("status")).toHaveText("Se importaron 2 prospectos.");
  });
});
