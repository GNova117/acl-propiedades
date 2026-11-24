import { test, expect } from "./fixtures.js";

// Punto 87: un mensaje que llega mientras el panel está abierto aparece sin recargar ni cambiar de pantalla.
// En modo demo «llegar» = otra pestaña del mismo navegador guarda un mensaje (evento storage); con Supabase es Realtime.
test.describe("Tiempo real del panel", () => {
  test("un mensaje nuevo aparece en la lista abierta, sin recargar", async ({ page, go, seedAdminSession }) => {
    await seedAdminSession();
    await go("/admin/mensajes");
    await expect(page.locator("h1")).toContainText("Mensajes");
    await expect(page.getByText("Mensaje de QA en vivo")).toHaveCount(0);

    // «Otra pestaña» (otro visitante en el mismo navegador): guarda el mensaje directamente.
    const otra = await page.context().newPage();
    await otra.route((url) => url.origin !== new URL(page.url()).origin, (route) => route.abort());
    await otra.goto(new URL("/favicon.svg", page.url()).href);
    await otra.evaluate(() => {
      const key = "acl_local_messages";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push({ id: "msg-qa-vivo", name: "Persona QA", email: "qa@correo.com", message: "Mensaje de QA en vivo", status: "nuevo", created_at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list));
    });
    await otra.close();

    await expect(page.getByText("Mensaje de QA en vivo")).toBeVisible({ timeout: 8000 });
  });
});
