import { test, expect } from "./fixtures.js";

// Atajos del teléfono (app instalada): accesos directos del ícono («Mi día», «Prospecto rápido»), «Compartir → ACL Panel» (Android) que
// abre el prospecto rápido con lo compartido, y el número de pendientes sobre el ícono (Badging API).

const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), clave);

test.describe("Atajos del teléfono", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("el manifest trae los accesos directos y el destino de «Compartir»", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    const shortcuts = Object.fromEntries(manifest.shortcuts.map((s) => [s.name, s.url]));
    expect(shortcuts["Mi día"]).toBe("/admin/mi-dia");
    expect(shortcuts["Prospecto rápido"]).toBe("/admin/prospectos?captura=prospecto");
    expect(Object.keys(shortcuts)).toEqual(expect.arrayContaining(["Agenda", "Prospectos", "Mensajes"]));
    expect(manifest.share_target).toEqual({ action: "/admin/compartir", method: "GET", params: { title: "title", text: "text", url: "url" } });
    // Todo dentro del alcance de la app.
    for (const url of [...Object.values(shortcuts), manifest.share_target.action]) expect(url.startsWith("/")).toBe(true);
  });

  test("el acceso directo «Prospecto rápido» abre la hoja una vez y limpia la dirección", async ({ page, go }) => {
    await go("/admin/prospectos?captura=prospecto");
    await expect(page.locator(".quick-capture__sheet")).toBeVisible();
    await expect(page.locator("#qc-name")).toBeFocused();
    await expect(page).toHaveURL(/\/admin\/prospectos$/);
    await page.reload();
    await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
    await expect(page.locator(".quick-capture__sheet")).toHaveCount(0);
  });

  test("compartir un contacto desde otra app abre el prospecto rápido con nombre y teléfono, y se guarda con el texto en las notas", async ({ page, go, press }) => {
    await go(`/admin/compartir?text=${encodeURIComponent("Luis Ramírez QA\n+52 871 123 4567")}`);
    const hoja = page.locator(".quick-capture__sheet");
    await expect(hoja).toBeVisible();
    await expect(hoja.locator("#qc-name")).toHaveValue("Luis Ramírez QA");
    await expect(hoja.locator("#qc-phone")).toHaveValue("8711234567");
    await expect(hoja.locator("#qc-pasted")).toHaveValue("Luis Ramírez QA\n+52 871 123 4567");
    await expect(page).toHaveURL(/\/admin\/prospectos$/);

    await press(hoja.locator("button[type=submit]"));
    await expect(page.locator(".quick-capture__done")).toBeVisible();
    const [prospecto] = (await leer(page, "acl_local_prospectos")).filter((p) => p.name === "Luis Ramírez QA");
    expect(prospecto).toMatchObject({ phone: "8711234567", stage: "nuevo" });
    expect(prospecto.notes).toContain("+52 871 123 4567");
  });

  test("compartir un mensaje de WhatsApp: el nombre queda vacío (se escribe), el teléfono se saca del texto", async ({ page, go }) => {
    await go(`/admin/compartir?text=${encodeURIComponent("Hola, me interesa la casa de Lerdo. Mi cel 871 555 0199")}`);
    const hoja = page.locator(".quick-capture__sheet");
    await expect(hoja).toBeVisible();
    await expect(hoja.locator("#qc-name")).toHaveValue("");
    await expect(hoja.locator("#qc-phone")).toHaveValue("8715550199");
    await expect(hoja.locator("#qc-pasted")).toHaveValue(/me interesa la casa de Lerdo/);
  });
});

test.describe("Número de pendientes en el ícono", () => {
  test("la insignia sigue al número de la campana y se quita al cerrar sesión", async ({ page, go, press, seedAdminSession, isMobile }) => {
    await seedAdminSession();
    // Una Badging API de mentira que anota lo que se le pide.
    await page.addInitScript(() => {
      window.__badge = [];
      navigator.setAppBadge = (n) => (window.__badge.push(n), Promise.resolve());
      navigator.clearAppBadge = () => (window.__badge.push(0), Promise.resolve());
    });
    await go("/admin/panel");
    const mensajes = Array.from({ length: 3 }, (_, i) => ({ id: `m${i}`, name: `Persona ${i} QA`, email: "a@a.com", phone: "8715550101", message: "Hola", channel: "formulario", status: "nuevo", created_at: new Date().toISOString() }));
    await poner(page, "acl_local_messages", mensajes);
    await go("/admin/panel");

    const campana = page.locator(".notification-bell__badge");
    await expect(campana).toBeVisible();
    const total = Number(await campana.innerText());
    expect(total).toBeGreaterThanOrEqual(3);
    await expect.poll(async () => (await page.evaluate(() => window.__badge)).at(-1)).toBe(total);

    if (isMobile) await press(page.getByRole("button", { name: "Más" })); // en el teléfono «Cerrar sesión» está en el menú
    await press(page.getByRole("button", { name: "Cerrar sesión" }));
    await expect.poll(async () => (await page.evaluate(() => window.__badge)).at(-1)).toBe(0);
  });
});
