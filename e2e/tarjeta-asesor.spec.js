import { test, expect, ADMIN, expectHealthyPage } from "./fixtures.js";

// Página y tarjeta digital del asesor (/asesor/<slug>): foto y datos, WhatsApp, llamar, guardar contacto (.vcf), sus propiedades y un
// formulario cuyo mensaje llega a ESE asesor (y se vuelve su prospecto). En Mi perfil, su enlace y su QR para compartir.

const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), clave);

const asesor = (over = {}) => ({
  id: "advisor-qa",
  name: "Ana María Pérez QA",
  photo_url: "",
  phone: "871 324 3271",
  email: "ana.qa@aclpropiedades.com",
  whatsapp: "528713243271",
  bio: "Asesora QA con experiencia en crédito",
  active: true,
  show_in_team: true,
  ...over,
});

const propiedad = (id, title, advisor_ids, extra = {}) => ({
  id,
  code: id.toUpperCase(),
  title,
  type: "casa",
  description: "x",
  price: 1500000,
  area_m2: 100,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  zone: "Lerdo",
  address: "Calle 1, Lerdo",
  lat: 25.5,
  lng: -103.5,
  status: "disponible",
  operation_type: "compra",
  active: true,
  main_image: "",
  images: [],
  advisor_ids,
  created_at: hace(100),
  updated_at: hace(100),
  ...extra,
});

async function preparar(page, go) {
  await go("/");
  await poner(page, "acl_local_advisors", [asesor(), asesor({ id: "advisor-oculto", name: "Oculto QA", show_in_team: false }), asesor({ id: "advisor-otro", name: "Otro Asesor QA", phone: "8710000000" })]);
  await poner(page, "acl_local_properties", [
    propiedad("prop-ana", "Casa de Ana QA", ["advisor-qa"]),
    propiedad("prop-ana-vendida", "Vendida de Ana QA", ["advisor-qa"], { status: "vendida" }),
    propiedad("prop-otro", "Casa de Otro QA", ["advisor-otro"]),
  ]);
}

test.describe("Página pública del asesor", () => {
  test("muestra sus datos y botones, solo sus propiedades disponibles, y guarda su contacto en un .vcf", async ({ page, go }) => {
    await preparar(page, go);
    await go("/asesor/ana-maria-perez-qa");

    await expect(page.getByRole("heading", { level: 1, name: "Ana María Pérez QA" })).toBeVisible();
    await expect(page.getByText("Asesora QA con experiencia en crédito")).toBeVisible();

    const hero = page.locator(".advisor-page__hero"); // el pie del sitio también trae un WhatsApp
    const whatsapp = await hero.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
    expect(whatsapp.startsWith("https://wa.me/528713243271?text=")).toBe(true);
    expect(decodeURIComponent(whatsapp.split("text=")[1])).toBe("Hola Ana, vi tu tarjeta de ACL Propiedades y quiero más información.");
    await expect(hero.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:8713243271");
    await expect(hero.getByRole("link", { name: "Correo" })).toHaveAttribute("href", "mailto:ana.qa@aclpropiedades.com");

    await expect(page.getByText("Casa de Ana QA")).toBeVisible();
    await expect(page.getByText("Vendida de Ana QA")).toHaveCount(0);
    await expect(page.getByText("Casa de Otro QA")).toHaveCount(0);

    const descarga = page.waitForEvent("download");
    await hero.getByRole("button", { name: "Guardar contacto" }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe("ana-maria-perez-qa.vcf");
    const texto = await (await import("node:fs/promises")).readFile(await archivo.path(), "utf8");
    expect(texto).toContain("BEGIN:VCARD");
    expect(texto).toContain("FN:Ana María Pérez QA");
    expect(texto).toContain("TEL;TYPE=CELL,VOICE:+528713243271");
    expect(texto).toContain("EMAIL;TYPE=INTERNET,WORK:ana.qa@aclpropiedades.com");
    expect(texto).toContain("/asesor/ana-maria-perez-qa");
    await expectHealthyPage(page);
  });

  test("el mensaje del formulario llega a ese asesor y se vuelve su prospecto nuevo", async ({ page, go, press }) => {
    await preparar(page, go);
    await go("/asesor/ana-maria-perez-qa");
    const formulario = page.locator(".advisor-page__form");

    await press(formulario.getByRole("button", { name: "Enviar mensaje" }));
    await expect(formulario.getByText("Este campo es obligatorio.")).toHaveCount(3);

    await formulario.getByLabel(/Tu nombre/).fill("Luis Visitante QA");
    await formulario.getByLabel(/Tu teléfono/).fill("123");
    await formulario.getByLabel(/¿En qué te ayuda\?/).fill("Busco casa en Lerdo");
    await press(formulario.getByRole("button", { name: "Enviar mensaje" }));
    await expect(formulario.getByText("Escribe un teléfono de 10 dígitos.")).toBeVisible();

    await formulario.getByLabel(/Tu teléfono/).fill("871 555 0123");
    await press(formulario.getByRole("button", { name: "Enviar mensaje" }));
    await expect(formulario.getByText("Ana recibió tu mensaje y te contactará pronto.")).toBeVisible();

    const [mensaje] = (await leer(page, "acl_local_messages")).filter((m) => m.channel === "asesor");
    expect(mensaje).toMatchObject({ name: "Luis Visitante QA", advisor_id: "advisor-qa", message: "Busco casa en Lerdo" });
    const [prospecto] = await leer(page, "acl_local_prospectos");
    expect(prospecto).toMatchObject({ name: "Luis Visitante QA", advisor_id: "advisor-qa", stage: "nuevo", message_id: mensaje.id });
  });

  test("un enlace que no existe, o de un asesor oculto del equipo, no muestra nada", async ({ page, go }) => {
    await preparar(page, go);
    for (const slug of ["no-existe", "oculto-qa"]) {
      await go(`/asesor/${slug}`);
      await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver al equipo" })).toHaveAttribute("href", "/nosotros");
    }
  });

  test("Nosotros enlaza al perfil de cada asesor visible", async ({ page, go }) => {
    await preparar(page, go);
    await go("/nosotros");
    const tarjeta = page.locator(".advisor-card", { hasText: "Ana María Pérez QA" });
    await expect(tarjeta.getByRole("link", { name: "Ver perfil" })).toHaveAttribute("href", "/asesor/ana-maria-perez-qa");
    await expect(page.getByText("Oculto QA")).toHaveCount(0);
  });
});

test.describe("Tu tarjeta digital (Mi perfil)", () => {
  test("el asesor ve su enlace y su QR, y puede copiar el enlace", async ({ page, go, press, seedAdminSession, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedAdminSession();
    await preparar(page, go);
    await poner(page, "acl_local_admin_access", [{ id: "access-qa", email: ADMIN.email, role_id: "role-admin", advisor_id: "advisor-qa" }]);
    await go("/admin/mi-perfil");

    const tarjeta = page.locator(".advisor-share");
    await expect(tarjeta.getByRole("heading", { name: "Tu tarjeta digital" })).toBeVisible();
    const enlace = await tarjeta.getByLabel("Tu enlace").inputValue();
    expect(enlace.endsWith("/asesor/ana-maria-perez-qa")).toBe(true);
    await expect(tarjeta.locator("canvas.advisor-share__qr-canvas")).toBeVisible();
    await expect(tarjeta.getByRole("link", { name: "Ver mi página" })).toHaveAttribute("href", "/asesor/ana-maria-perez-qa");

    await press(tarjeta.getByRole("button", { name: "Copiar enlace" }));
    await expect(tarjeta.getByRole("button", { name: "Copiado" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(enlace);

    const mandar = await tarjeta.getByRole("link", { name: "Mandar por WhatsApp" }).getAttribute("href");
    expect(decodeURIComponent(mandar.split("text=")[1])).toContain(enlace);

    const descarga = page.waitForEvent("download");
    await press(tarjeta.getByRole("button", { name: "Descargar QR" }));
    expect((await descarga).suggestedFilename()).toBe("QR_ana-maria-perez-qa.png");
  });
});
